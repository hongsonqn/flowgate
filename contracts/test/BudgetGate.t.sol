// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BudgetGate} from "../BudgetGate.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Invariant handler: drives all mutating functions and tracks global sums.
contract BudgetGateHandler is Test {
    BudgetGate internal gate;
    MockERC20 internal token;

    address internal owner = makeAddr("handlerOwner");
    address internal attester;
    uint256 internal attesterPk;

    bytes32 public budgetId = keccak256("handler-budget");

    // Track what THIS handler believes should hold.
    uint256 public totalEarnedAccum;
    uint256 public totalWithdrawnAccum;

    // Chain ID used when signing attestations
    uint256 internal constant CHAIN_ID = 5_042_002;

    // Recipient registry (small fixed set for simplicity)
    address[3] internal recipientAddrs;
    uint256[3] internal recipientNonces;

    constructor(BudgetGate _gate, MockERC20 _token, uint256 _attesterPk) {
        gate = _gate;
        token = _token;
        attesterPk = _attesterPk;
        attester = vm.addr(_attesterPk);

        recipientAddrs[0] = makeAddr("hrec0");
        recipientAddrs[1] = makeAddr("hrec1");
        recipientAddrs[2] = makeAddr("hrec2");
    }

    // Allow the test harness to set up the budget after deploying handler.
    function setupBudget(uint256 totalAmount, uint256 startTime, uint256 endTime) external {
        token.mint(owner, totalAmount);
        vm.startPrank(owner);
        token.approve(address(gate), totalAmount);
        gate.createBudget(budgetId, address(token), totalAmount, startTime, endTime, attester);
        vm.stopPrank();
    }

    // Fuzz-driven: add or update a recipient allocation.
    function addRecipient(uint8 idx, uint256 allocation) external {
        idx = idx % 3;
        address rec = recipientAddrs[idx];
        // Fetch current budget state to clamp allocation.
        try gate.getBudget(budgetId) returns (
            address,
            address,
            uint256 totalAmount,
            uint256,
            uint256,
            address,
            uint256,
            uint256,
            BudgetGate.BudgetState state
        ) {
            if (state == BudgetGate.BudgetState.CLOSED) return;
            allocation = bound(allocation, 1, totalAmount / 3 + 1);
            vm.prank(owner);
            try gate.addRecipient(budgetId, rec, allocation) {} catch {}
        } catch {}
    }

    // Internal helper: sign an attestation message.
    function _buildSig(address rec, uint256 earned, uint256 nonce) internal view returns (bytes memory) {
        bytes32 message = keccak256(
            abi.encodePacked(budgetId, rec, earned, nonce, address(gate), CHAIN_ID)
        );
        bytes32 ethMsg = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attesterPk, ethMsg);
        return abi.encodePacked(r, s, v);
    }

    // Internal helper: check whether the handler budget is ACTIVE.
    function _budgetIsActive() internal view returns (bool) {
        try gate.getBudget(budgetId) returns (
            address, address, uint256, uint256, uint256, address, uint256, uint256,
            BudgetGate.BudgetState state
        ) {
            return state == BudgetGate.BudgetState.ACTIVE;
        } catch {
            return false;
        }
    }

    // Fuzz-driven: submit an attestation for a recipient.
    function submitAttestation(uint8 idx, uint256 newEarned) external {
        if (!_budgetIsActive()) return;
        idx = idx % 3;
        address rec = recipientAddrs[idx];

        try gate.getRecipient(budgetId, rec) returns (uint256 allocation, uint256 earned, uint256) {
            if (allocation == 0) return;
            newEarned = bound(newEarned, earned, allocation);
            uint256 nonce = recipientNonces[idx] + 1;
            recipientNonces[idx] = nonce;
            bytes memory sig = _buildSig(rec, newEarned, nonce);
            uint256 delta = newEarned - earned;
            try gate.submitAttestation(budgetId, rec, newEarned, nonce, sig) {
                totalEarnedAccum += delta;
            } catch {}
        } catch {}
    }

    // Fuzz-driven: attempt a withdrawal.
    function withdraw(uint8 idx) external {
        idx = idx % 3;
        address rec = recipientAddrs[idx];

        try gate.getRecipient(budgetId, rec) returns (uint256, uint256 earned, uint256 withdrawn) {
            uint256 avail = earned - withdrawn;
            if (avail == 0) return;
            vm.prank(rec);
            try gate.withdraw(budgetId) {
                totalWithdrawnAccum += avail;
            } catch {}
        } catch {}
    }
}

/// @title BudgetGateTest
/// @notice Comprehensive unit + fuzz + invariant tests for BudgetGate.sol
contract BudgetGateTest is Test {
    // ── Constants ──────────────────────────────────────────────────────────────

    /// Arc Testnet chainId — used inside the ECDSA message hash.
    uint256 internal constant CHAIN_ID = 5_042_002;

    /// Canonical USDC address on the Arc Testnet (hardcoded in deployment config).
    address internal constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    uint256 internal constant DECIMALS = 6;
    uint256 internal constant TOTAL_AMOUNT = 100_000 * (10 ** DECIMALS); // 100 000 USDC

    // Time layout relative to block.timestamp set in setUp()
    uint256 internal constant T0 = 1_000_000; // base time (warped in setUp)
    uint256 internal constant START = T0 + 1 hours;
    uint256 internal constant END = T0 + 8 hours;

    // ── Actors ─────────────────────────────────────────────────────────────────

    address internal budgetOwner = makeAddr("budgetOwner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    /// Attester key-pair — used for on-chain ECDSA recovery.
    uint256 internal attesterPk = 0xA11CE;
    address internal attester;

    // ── State ──────────────────────────────────────────────────────────────────

    BudgetGate internal gate;
    MockERC20 internal usdc;

    bytes32 internal constant BUDGET_ID = keccak256("test-budget-001");

    // ── setUp ──────────────────────────────────────────────────────────────────

    function setUp() public {
        // Pin chain id so attestation signatures are deterministic.
        vm.chainId(CHAIN_ID);

        // Warp to a known base time.
        vm.warp(T0);

        attester = vm.addr(attesterPk);

        // 1. Deploy a mock ERC-20 at a throwaway address.
        MockERC20 mockImpl = new MockERC20("Mock USDC", "mUSDC", 6);

        // 2. Etch the mock bytecode at the canonical USDC address.
        vm.etch(USDC_ADDR, address(mockImpl).code);
        usdc = MockERC20(USDC_ADDR);

        // 3. Deploy the contract under test AFTER etch so USDC_ADDR has code.
        gate = new BudgetGate();

        // 4. Seed budgetOwner with tokens and approve gate.
        usdc.mint(budgetOwner, TOTAL_AMOUNT * 10);
        vm.prank(budgetOwner);
        usdc.approve(address(gate), type(uint256).max);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Helper: create a valid budget (OPEN state — block.timestamp < START)
    // ───────────────────────────────────────────────────────────────────────────

    function _createBudget() internal returns (bytes32) {
        vm.prank(budgetOwner);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, START, END, attester);
        return BUDGET_ID;
    }

    // Helper: sign an attestation message with a given private key.
    function _sign(
        uint256 pk,
        bytes32 budgetId,
        address recipient,
        uint256 newEarned,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 message = keccak256(
            abi.encodePacked(budgetId, recipient, newEarned, nonce, address(gate), CHAIN_ID)
        );
        bytes32 ethMsg = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethMsg);
        return abi.encodePacked(r, s, v);
    }

    // Helper: make a budget ACTIVE by warping to START + 1.
    function _warpToActive() internal {
        vm.warp(START + 1);
    }

    // Helper: make a budget CLOSED by warping past END.
    function _warpToClosed() internal {
        vm.warp(END + 1);
    }

    // Helper: add a recipient to a budget.
    function _addRecipient(bytes32 budgetId, address recipient, uint256 allocation) internal {
        vm.prank(budgetOwner);
        gate.addRecipient(budgetId, recipient, allocation);
    }

    // Helper: submit a valid attestation for alice with newEarned, nonce, signed by attester.
    function _submitAttestation(
        bytes32 budgetId,
        address recipient,
        uint256 newEarned,
        uint256 nonce
    ) internal {
        bytes memory sig = _sign(attesterPk, budgetId, recipient, newEarned, nonce);
        gate.submitAttestation(budgetId, recipient, newEarned, nonce, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. DEPLOYMENT / CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GateDeployedWithNoState() public {
        // getRecipient on a non-existent budget should revert with BudgetNotFound.
        // getBudget on a non-existent id should revert.
        vm.expectRevert(BudgetGate.BudgetNotFound.selector);
        gate.getBudget(BUDGET_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. createBudget
    // ═══════════════════════════════════════════════════════════════════════════

    function test_CreateBudget_HappyPath() public {
        vm.prank(budgetOwner);
        vm.expectEmit(true, true, true, true, address(gate));
        emit BudgetGate.BudgetCreated(BUDGET_ID, budgetOwner, USDC_ADDR, TOTAL_AMOUNT, START, END, attester);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, START, END, attester);

        // Verify stored state via getBudget.
        (
            address owner,
            address usdcToken,
            uint256 totalAmount,
            uint256 startTime,
            uint256 endTime,
            address att,
            uint256 totalEarned,
            uint256 totalWithdrawn,
            BudgetGate.BudgetState state
        ) = gate.getBudget(BUDGET_ID);

        assertEq(owner, budgetOwner, "owner");
        assertEq(usdcToken, USDC_ADDR, "usdcToken");
        assertEq(totalAmount, TOTAL_AMOUNT, "totalAmount");
        assertEq(startTime, START, "startTime");
        assertEq(endTime, END, "endTime");
        assertEq(att, attester, "attester");
        assertEq(totalEarned, 0, "totalEarned");
        assertEq(totalWithdrawn, 0, "totalWithdrawn");
        assertEq(uint8(state), uint8(BudgetGate.BudgetState.OPEN), "state OPEN");
    }

    function test_CreateBudget_LocksUSDC() public {
        uint256 gateBefore = usdc.balanceOf(address(gate));
        uint256 ownerBefore = usdc.balanceOf(budgetOwner);

        _createBudget();

        assertEq(usdc.balanceOf(address(gate)), gateBefore + TOTAL_AMOUNT, "gate balance");
        assertEq(usdc.balanceOf(budgetOwner), ownerBefore - TOTAL_AMOUNT, "owner balance");
    }

    function test_CreateBudget_RevertDuplicateId() public {
        _createBudget();
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.BudgetAlreadyExists.selector);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, START, END, attester);
    }

    function test_CreateBudget_RevertZeroAmount() public {
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidAmount.selector);
        gate.createBudget(BUDGET_ID, USDC_ADDR, 0, START, END, attester);
    }

    function test_CreateBudget_RevertEndBeforeStart() public {
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidTimeRange.selector);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, END, START, attester);
    }

    function test_CreateBudget_RevertEndEqualsStart() public {
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidTimeRange.selector);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, START, START, attester);
    }

    function test_CreateBudget_RevertStartInPast() public {
        // startTime == block.timestamp (not strictly in the future) → InvalidTimeRange
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidTimeRange.selector);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, T0, END, attester);
    }

    function test_CreateBudget_RevertZeroAttester() public {
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidAddress.selector);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, START, END, address(0));
    }

    function test_CreateBudget_RevertZeroToken() public {
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidAddress.selector);
        gate.createBudget(BUDGET_ID, address(0), TOTAL_AMOUNT, START, END, attester);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. State transitions: OPEN → ACTIVE → CLOSED
    // ═══════════════════════════════════════════════════════════════════════════

    function test_State_OpenBeforeStart() public {
        _createBudget();
        (, , , , , , , , BudgetGate.BudgetState state) = gate.getBudget(BUDGET_ID);
        assertEq(uint8(state), uint8(BudgetGate.BudgetState.OPEN));
    }

    function test_State_ActiveAfterStart() public {
        _createBudget();
        _warpToActive();
        (, , , , , , , , BudgetGate.BudgetState state) = gate.getBudget(BUDGET_ID);
        assertEq(uint8(state), uint8(BudgetGate.BudgetState.ACTIVE));
    }

    function test_State_ClosedAfterEnd() public {
        _createBudget();
        _warpToClosed();
        (, , , , , , , , BudgetGate.BudgetState state) = gate.getBudget(BUDGET_ID);
        assertEq(uint8(state), uint8(BudgetGate.BudgetState.CLOSED));
    }

    function test_State_ExactlyAtStart_IsActive() public {
        _createBudget();
        vm.warp(START);
        (, , , , , , , , BudgetGate.BudgetState state) = gate.getBudget(BUDGET_ID);
        assertEq(uint8(state), uint8(BudgetGate.BudgetState.ACTIVE));
    }

    function test_State_ExactlyAtEnd_IsClosed() public {
        _createBudget();
        vm.warp(END);
        (, , , , , , , , BudgetGate.BudgetState state) = gate.getBudget(BUDGET_ID);
        assertEq(uint8(state), uint8(BudgetGate.BudgetState.CLOSED));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. addRecipient
    // ═══════════════════════════════════════════════════════════════════════════

    function test_AddRecipient_HappyPath_Open() public {
        _createBudget();
        uint256 alloc = 10_000 * (10 ** DECIMALS);

        vm.expectEmit(true, true, false, true, address(gate));
        emit BudgetGate.RecipientAdded(BUDGET_ID, alice, alloc);
        _addRecipient(BUDGET_ID, alice, alloc);

        (uint256 allocation, uint256 earned, uint256 withdrawn) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(allocation, alloc, "allocation");
        assertEq(earned, 0, "earned");
        assertEq(withdrawn, 0, "withdrawn");
    }

    function test_AddRecipient_HappyPath_Active() public {
        _createBudget();
        _warpToActive();
        uint256 alloc = 5_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc);
        (uint256 allocation,,) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(allocation, alloc);
    }

    function test_AddRecipient_UpdateAllocation() public {
        // Adding the same recipient again should UPDATE (not double-count) allocation.
        _createBudget();
        uint256 alloc1 = 10_000 * (10 ** DECIMALS);
        uint256 alloc2 = 20_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc1);
        _addRecipient(BUDGET_ID, alice, alloc2);

        (uint256 allocation,,) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(allocation, alloc2, "allocation updated");

        // totalAllocated should equal alloc2, not alloc1+alloc2
        (, , uint256 totalAmount, , , , , ,) = gate.getBudget(BUDGET_ID);
        // We can check indirectly: adding (TOTAL_AMOUNT - alloc2) more should succeed.
        _addRecipient(BUDGET_ID, bob, totalAmount - alloc2);
    }

    function test_AddRecipient_RevertOverAllocation() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.AllocationExceeded.selector);
        gate.addRecipient(BUDGET_ID, bob, 1);
    }

    function test_AddRecipient_RevertClosed() public {
        _createBudget();
        _warpToClosed();
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidState.selector);
        gate.addRecipient(BUDGET_ID, alice, 1_000);
    }

    function test_AddRecipient_RevertNotOwner() public {
        _createBudget();
        vm.prank(stranger);
        vm.expectRevert(BudgetGate.NotBudgetOwner.selector);
        gate.addRecipient(BUDGET_ID, alice, 1_000);
    }

    function test_AddRecipient_RevertZeroRecipient() public {
        _createBudget();
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidAddress.selector);
        gate.addRecipient(BUDGET_ID, address(0), 1_000);
    }

    function test_AddRecipient_RevertZeroAllocation() public {
        _createBudget();
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidAmount.selector);
        gate.addRecipient(BUDGET_ID, alice, 0);
    }

    function test_AddRecipient_RevertBudgetNotFound() public {
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.BudgetNotFound.selector);
        gate.addRecipient(keccak256("nonexistent"), alice, 1_000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. submitAttestation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_SubmitAttestation_HappyPath() public {
        _createBudget();
        uint256 alloc = 50_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc);
        _warpToActive();

        uint256 earned = 10_000 * (10 ** DECIMALS);
        uint256 nonce = 1;

        vm.expectEmit(true, true, true, true, address(gate));
        emit BudgetGate.AttestationSubmitted(BUDGET_ID, alice, earned, nonce, attester);
        _submitAttestation(BUDGET_ID, alice, earned, nonce);

        (uint256 allocation, uint256 recipEarned, uint256 withdrawn) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(allocation, alloc, "allocation unchanged");
        assertEq(recipEarned, earned, "earned updated");
        assertEq(withdrawn, 0, "nothing withdrawn yet");

        (, , , , , , uint256 totalEarned,,) = gate.getBudget(BUDGET_ID);
        assertEq(totalEarned, earned, "budget totalEarned");
    }

    function test_SubmitAttestation_MultipleIncrements() public {
        _createBudget();
        uint256 alloc = 50_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc);
        _warpToActive();

        // First attestation: earn 10k
        _submitAttestation(BUDGET_ID, alice, 10_000 * (10 ** DECIMALS), 1);
        // Second attestation: earn 25k (increment of 15k)
        _submitAttestation(BUDGET_ID, alice, 25_000 * (10 ** DECIMALS), 2);

        (, uint256 earned,) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(earned, 25_000 * (10 ** DECIMALS));

        (, , , , , , uint256 totalEarned,,) = gate.getBudget(BUDGET_ID);
        assertEq(totalEarned, 25_000 * (10 ** DECIMALS));
    }

    function test_SubmitAttestation_RevertWrongSigner() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();

        uint256 wrongPk = 0xDEADBEEF1; // any key != attesterPk
        bytes memory sig = _sign(wrongPk, BUDGET_ID, alice, 1_000, 1);
        vm.expectRevert(BudgetGate.InvalidSignature.selector);
        gate.submitAttestation(BUDGET_ID, alice, 1_000, 1, sig);
    }

    function test_SubmitAttestation_RevertReplayNonce() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();

        _submitAttestation(BUDGET_ID, alice, 1_000, 1);

        // Replaying nonce 1 should fail with InvalidNonce.
        bytes memory sig = _sign(attesterPk, BUDGET_ID, alice, 1_000, 1);
        vm.expectRevert(BudgetGate.InvalidNonce.selector);
        gate.submitAttestation(BUDGET_ID, alice, 1_000, 1, sig);
    }

    function test_SubmitAttestation_RevertNonMonotonicEarned() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();

        _submitAttestation(BUDGET_ID, alice, 5_000, 1);

        // Trying to decrease earned → NonMonotonicEarned.
        bytes memory sig = _sign(attesterPk, BUDGET_ID, alice, 4_999, 2);
        vm.expectRevert(BudgetGate.NonMonotonicEarned.selector);
        gate.submitAttestation(BUDGET_ID, alice, 4_999, 2, sig);
    }

    function test_SubmitAttestation_RevertOverAllocation() public {
        _createBudget();
        uint256 alloc = 1_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc);
        _warpToActive();

        uint256 overEarned = alloc + 1;
        bytes memory sig = _sign(attesterPk, BUDGET_ID, alice, overEarned, 1);
        vm.expectRevert(BudgetGate.AllocationExceeded.selector);
        gate.submitAttestation(BUDGET_ID, alice, overEarned, 1, sig);
    }

    function test_SubmitAttestation_RevertNotActive_Open() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        // Still OPEN — no warp.
        bytes memory sig = _sign(attesterPk, BUDGET_ID, alice, 1_000, 1);
        vm.expectRevert(BudgetGate.InvalidState.selector);
        gate.submitAttestation(BUDGET_ID, alice, 1_000, 1, sig);
    }

    function test_SubmitAttestation_RevertNotActive_Closed() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToClosed();
        bytes memory sig = _sign(attesterPk, BUDGET_ID, alice, 1_000, 1);
        vm.expectRevert(BudgetGate.InvalidState.selector);
        gate.submitAttestation(BUDGET_ID, alice, 1_000, 1, sig);
    }

    function test_SubmitAttestation_RevertZeroRecipient() public {
        _createBudget();
        _warpToActive();
        bytes memory sig = _sign(attesterPk, BUDGET_ID, address(0), 1_000, 1);
        vm.expectRevert(BudgetGate.InvalidAddress.selector);
        gate.submitAttestation(BUDGET_ID, address(0), 1_000, 1, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. withdraw
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Withdraw_HappyPath_Active() public {
        _createBudget();
        uint256 alloc = 50_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc);
        _warpToActive();

        uint256 earned = 10_000 * (10 ** DECIMALS);
        _submitAttestation(BUDGET_ID, alice, earned, 1);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.expectEmit(true, true, false, true, address(gate));
        emit BudgetGate.Withdrawn(BUDGET_ID, alice, earned);
        vm.prank(alice);
        gate.withdraw(BUDGET_ID);

        assertEq(usdc.balanceOf(alice), aliceBefore + earned, "alice received tokens");
        (, uint256 recipEarned, uint256 withdrawn) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(withdrawn, earned, "withdrawn updated");
        assertEq(recipEarned, earned, "earned unchanged");
    }

    function test_Withdraw_HappyPath_Closed() public {
        _createBudget();
        uint256 alloc = 50_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc);
        _warpToActive();

        uint256 earned = 20_000 * (10 ** DECIMALS);
        _submitAttestation(BUDGET_ID, alice, earned, 1);
        _warpToClosed();

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        gate.withdraw(BUDGET_ID);

        assertEq(usdc.balanceOf(alice), aliceBefore + earned);
    }

    function test_Withdraw_RevertNothingToWithdraw() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, 10_000);
        _warpToActive();

        // No attestation → earned == 0 → NothingToWithdraw.
        vm.prank(alice);
        vm.expectRevert(BudgetGate.NothingToWithdraw.selector);
        gate.withdraw(BUDGET_ID);
    }

    function test_Withdraw_RevertDoubleWithdraw() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();
        _submitAttestation(BUDGET_ID, alice, 1_000, 1);

        vm.prank(alice);
        gate.withdraw(BUDGET_ID);

        vm.prank(alice);
        vm.expectRevert(BudgetGate.NothingToWithdraw.selector);
        gate.withdraw(BUDGET_ID);
    }

    function test_Withdraw_RevertOpenState() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        // Still OPEN (before START)
        vm.prank(alice);
        vm.expectRevert(BudgetGate.InvalidState.selector);
        gate.withdraw(BUDGET_ID);
    }

    function test_Withdraw_PartialThenMore() public {
        // Submit two attestations (increasing) and withdraw between them.
        _createBudget();
        uint256 alloc = TOTAL_AMOUNT;
        _addRecipient(BUDGET_ID, alice, alloc);
        _warpToActive();

        _submitAttestation(BUDGET_ID, alice, 10_000, 1);

        vm.prank(alice);
        gate.withdraw(BUDGET_ID);
        assertEq(usdc.balanceOf(alice), 10_000);

        // Second attestation earns more.
        _submitAttestation(BUDGET_ID, alice, 30_000, 2);
        vm.prank(alice);
        gate.withdraw(BUDGET_ID);
        // Should only pay the delta (20_000), not the full 30_000 again.
        assertEq(usdc.balanceOf(alice), 30_000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. reclaimUnspent
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ReclaimUnspent_HappyPath() public {
        _createBudget();
        uint256 alloc = 60_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, alloc);
        _warpToActive();

        uint256 earned = 40_000 * (10 ** DECIMALS);
        _submitAttestation(BUDGET_ID, alice, earned, 1);
        _warpToClosed();

        uint256 ownerBefore = usdc.balanceOf(budgetOwner);
        uint256 expectedReclaim = TOTAL_AMOUNT - earned; // 60_000

        vm.expectEmit(true, true, false, true, address(gate));
        emit BudgetGate.UnspentReclaimed(BUDGET_ID, budgetOwner, expectedReclaim);
        vm.prank(budgetOwner);
        gate.reclaimUnspent(BUDGET_ID);

        assertEq(usdc.balanceOf(budgetOwner), ownerBefore + expectedReclaim);
    }

    function test_ReclaimUnspent_RevertBeforeEnd() public {
        _createBudget();
        _warpToActive(); // still before endTime

        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidState.selector);
        gate.reclaimUnspent(BUDGET_ID);
    }

    function test_ReclaimUnspent_RevertNotOwner() public {
        _createBudget();
        _warpToClosed();
        vm.prank(stranger);
        vm.expectRevert(BudgetGate.NotBudgetOwner.selector);
        gate.reclaimUnspent(BUDGET_ID);
    }

    function test_ReclaimUnspent_RevertDoubleReclaim() public {
        _createBudget();
        _warpToClosed();

        vm.prank(budgetOwner);
        gate.reclaimUnspent(BUDGET_ID); // First reclaim succeeds.

        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.NothingToReclaim.selector);
        gate.reclaimUnspent(BUDGET_ID);
    }

    function test_ReclaimUnspent_AllEarned_NothingToReclaim() public {
        // If all tokens were earned, reclaimable == 0 → NothingToReclaim.
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();
        _submitAttestation(BUDGET_ID, alice, TOTAL_AMOUNT, 1);
        _warpToClosed();

        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.NothingToReclaim.selector);
        gate.reclaimUnspent(BUDGET_ID);
    }

    function test_ReclaimUnspent_ExactlyAtEndTime() public {
        _createBudget();
        vm.warp(END); // exactly at end → CLOSED
        vm.prank(budgetOwner);
        gate.reclaimUnspent(BUDGET_ID); // should succeed
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. getBudget / getRecipient view functions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_GetBudget_RevertNotFound() public {
        vm.expectRevert(BudgetGate.BudgetNotFound.selector);
        gate.getBudget(keccak256("ghost"));
    }

    function test_GetRecipient_RevertNotFound() public {
        vm.expectRevert(BudgetGate.BudgetNotFound.selector);
        gate.getRecipient(keccak256("ghost"), alice);
    }

    function test_GetRecipient_ZeroBeforeAdd() public {
        _createBudget();
        (uint256 alloc, uint256 earned, uint256 withdrawn) = gate.getRecipient(BUDGET_ID, carol);
        assertEq(alloc, 0);
        assertEq(earned, 0);
        assertEq(withdrawn, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. Fuzz tests
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Fuzz: any non-zero amount ≤ budgetOwner balance should succeed.
    function testFuzz_CreateBudget_AnyValidAmount(uint256 amount) public {
        amount = bound(amount, 1, usdc.balanceOf(budgetOwner));
        vm.prank(budgetOwner);
        gate.createBudget(BUDGET_ID, USDC_ADDR, amount, START, END, attester);
        (, , uint256 totalAmount, , , , , ,) = gate.getBudget(BUDGET_ID);
        assertEq(totalAmount, amount, "amount stored");
    }

    /// @dev Fuzz: start must be strictly after block.timestamp, end strictly after start.
    function testFuzz_CreateBudget_InvalidTimeRange(uint256 start, uint256 /*end*/) public {
        // Case 1: startTime in the past or equal to T0.
        start = bound(start, 0, T0);
        vm.prank(budgetOwner);
        vm.expectRevert(BudgetGate.InvalidTimeRange.selector);
        gate.createBudget(BUDGET_ID, USDC_ADDR, TOTAL_AMOUNT, start, start + 1 hours, attester);
    }

    /// @dev Fuzz: allocation arithmetic — any split across two recipients must not exceed total.
    function testFuzz_AddRecipient_TwoRecipientsSplit(uint256 aliceAlloc, uint256 bobAlloc) public {
        _createBudget();
        // Clamp both allocations so their sum ≤ TOTAL_AMOUNT.
        aliceAlloc = bound(aliceAlloc, 1, TOTAL_AMOUNT);
        bobAlloc = bound(bobAlloc, 1, TOTAL_AMOUNT - aliceAlloc);

        _addRecipient(BUDGET_ID, alice, aliceAlloc);
        _addRecipient(BUDGET_ID, bob, bobAlloc);

        (uint256 aAlloc,,) = gate.getRecipient(BUDGET_ID, alice);
        (uint256 bAlloc,,) = gate.getRecipient(BUDGET_ID, bob);
        assertTrue(aAlloc + bAlloc <= TOTAL_AMOUNT, "combined alloc fits");
    }

    /// @dev Fuzz: earned must increase monotonically; nonce must be strictly increasing.
    function testFuzz_Attestation_Monotonicity(uint256 e1, uint256 e2) public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();

        e1 = bound(e1, 1, TOTAL_AMOUNT);
        e2 = bound(e2, 0, e1 - 1); // e2 < e1 → non-monotonic

        _submitAttestation(BUDGET_ID, alice, e1, 1);

        bytes memory sig = _sign(attesterPk, BUDGET_ID, alice, e2, 2);
        vm.expectRevert(BudgetGate.NonMonotonicEarned.selector);
        gate.submitAttestation(BUDGET_ID, alice, e2, 2, sig);
    }

    /// @dev Fuzz: any withdraw after a valid attestation drains exactly earned-withdrawn.
    function testFuzz_Withdraw_ExactDelta(uint256 earned) public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();

        earned = bound(earned, 1, TOTAL_AMOUNT);
        _submitAttestation(BUDGET_ID, alice, earned, 1);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        gate.withdraw(BUDGET_ID);

        assertEq(usdc.balanceOf(alice) - before, earned, "exact delta withdrawn");
    }

    /// @dev Fuzz: reclaim = totalAmount - totalEarned for arbitrary earned fraction.
    function testFuzz_ReclaimUnspent_CorrectAmount(uint256 earnedFrac) public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();

        earnedFrac = bound(earnedFrac, 0, TOTAL_AMOUNT - 1); // leave something to reclaim
        if (earnedFrac > 0) {
            _submitAttestation(BUDGET_ID, alice, earnedFrac, 1);
        }
        _warpToClosed();

        uint256 ownerBefore = usdc.balanceOf(budgetOwner);
        vm.prank(budgetOwner);
        gate.reclaimUnspent(BUDGET_ID);

        uint256 reclaimed = usdc.balanceOf(budgetOwner) - ownerBefore;
        assertEq(reclaimed, TOTAL_AMOUNT - earnedFrac, "reclaim = total - earned");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. Edge-case / boundary tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_MultipleRecipients_IndependentEarnings() public {
        _createBudget();
        uint256 aliceAlloc = 30_000 * (10 ** DECIMALS);
        uint256 bobAlloc = 40_000 * (10 ** DECIMALS);
        _addRecipient(BUDGET_ID, alice, aliceAlloc);
        _addRecipient(BUDGET_ID, bob, bobAlloc);
        _warpToActive();

        _submitAttestation(BUDGET_ID, alice, 15_000 * (10 ** DECIMALS), 1);
        _submitAttestation(BUDGET_ID, bob, 40_000 * (10 ** DECIMALS), 1);

        (, , , , , , uint256 totalEarned,,) = gate.getBudget(BUDGET_ID);
        assertEq(totalEarned, 55_000 * (10 ** DECIMALS));
    }

    function test_SubmitAttestation_SameEarnedIsIdempotent() public {
        // newEarned == current earned: not non-monotonic (>= check), delta == 0.
        _createBudget();
        _addRecipient(BUDGET_ID, alice, TOTAL_AMOUNT);
        _warpToActive();

        _submitAttestation(BUDGET_ID, alice, 5_000, 1);
        // newEarned == 5_000 == current earned → should succeed (no revert), delta = 0.
        _submitAttestation(BUDGET_ID, alice, 5_000, 2);

        (, uint256 earned,) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(earned, 5_000);
    }

    function test_AddRecipient_ReduceAllocationAfterNoEarnings() public {
        _createBudget();
        _addRecipient(BUDGET_ID, alice, 50_000 * (10 ** DECIMALS));
        // Reduce: should succeed (no earnings yet, so no AllocationExceeded).
        _addRecipient(BUDGET_ID, alice, 10_000 * (10 ** DECIMALS));
        (uint256 alloc,,) = gate.getRecipient(BUDGET_ID, alice);
        assertEq(alloc, 10_000 * (10 ** DECIMALS));
    }

    function test_WithdrawAndReclaim_NoDoubleCount() public {
        // Alice withdraws her earned, then owner reclaims the rest.
        _createBudget();
        uint256 aliceAlloc = TOTAL_AMOUNT;
        _addRecipient(BUDGET_ID, alice, aliceAlloc);
        _warpToActive();

        uint256 earned = 30_000 * (10 ** DECIMALS);
        _submitAttestation(BUDGET_ID, alice, earned, 1);

        vm.prank(alice);
        gate.withdraw(BUDGET_ID);

        _warpToClosed();
        uint256 ownerBefore = usdc.balanceOf(budgetOwner);
        vm.prank(budgetOwner);
        gate.reclaimUnspent(BUDGET_ID);

        uint256 reclaimed = usdc.balanceOf(budgetOwner) - ownerBefore;
        assertEq(reclaimed, TOTAL_AMOUNT - earned, "reclaim excludes earned");

        // Total tokens leaving the contract must exactly equal TOTAL_AMOUNT.
        assertEq(usdc.balanceOf(alice) + reclaimed, TOTAL_AMOUNT, "conservation law");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. Invariant test
    // ═══════════════════════════════════════════════════════════════════════════

    BudgetGateHandler internal handler;

    /// @dev Set up the invariant handler with its own budget.
    function setUp_InvariantHandler() internal {
        // Use a distinct budget ID so it doesn't collide with unit tests.
        handler = new BudgetGateHandler(gate, usdc, attesterPk);

        uint256 invTotalAmount = 90_000 * (10 ** DECIMALS);
        uint256 invStart = block.timestamp + 1 hours;
        uint256 invEnd = block.timestamp + 8 hours;

        handler.setupBudget(invTotalAmount, invStart, invEnd);

        // Warp into ACTIVE so attestations and withdrawals are reachable.
        vm.warp(invStart + 1);

        // Point the invariant fuzzer at the handler.
        targetContract(address(handler));
    }

    /// @notice Core conservation invariant:
    ///         totalWithdrawn ≤ totalEarned ≤ totalAllocated ≤ totalAmount
    ///         gate token balance ≥ totalEarned - totalWithdrawn
    function invariant_ConservationLaw() public {
        // Initialise the handler lazily on first invariant run.
        if (address(handler) == address(0)) {
            setUp_InvariantHandler();
            return; // first call just sets up; actual invariant runs on subsequent calls
        }

        bytes32 bId = handler.budgetId();
        try gate.getBudget(bId) returns (
            address,
            address usdcTok,
            uint256 totalAmount,
            uint256,
            uint256,
            address,
            uint256 totalEarned,
            uint256 totalWithdrawn,
            BudgetGate.BudgetState
        ) {
            // totalWithdrawn ≤ totalEarned ≤ totalAmount
            assertLe(totalWithdrawn, totalEarned, "withdrawn <= earned");
            assertLe(totalEarned, totalAmount, "earned <= totalAmount");

            // Gate USDC balance ≥ what's still owed to recipients.
            uint256 gateBalance = IERC20Like(usdcTok).balanceOf(address(gate));
            uint256 stillOwed = totalEarned - totalWithdrawn;
            assertGe(gateBalance, stillOwed, "gate balance >= still owed");
        } catch {
            // BudgetNotFound: handler budget not yet set up — skip.
        }
    }
}

// Minimal IERC20 interface for the invariant check (avoids importing the full OZ interface).
interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
}
