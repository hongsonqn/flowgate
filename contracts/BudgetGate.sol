// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BudgetGate is ReentrancyGuard {
    enum BudgetState {
        OPEN,
        ACTIVE,
        CLOSED
    }

    struct Budget {
        address owner;
        address usdcToken;
        address attester;
        uint256 totalAmount;
        uint256 startTime;
        uint256 endTime;
        uint256 totalAllocated;
        uint256 totalEarned;
        uint256 totalWithdrawn;
        uint256 reclaimedUnspent;
        bool exists;
    }

    struct RecipientData {
        uint256 allocation;
        uint256 earned;
        uint256 withdrawn;
        uint256 lastAttestationNonce;
    }

    mapping(bytes32 budgetId => Budget) private budgets;
    mapping(bytes32 budgetId => mapping(address recipient => RecipientData)) private recipients;

    event BudgetCreated(
        bytes32 indexed budgetId,
        address indexed owner,
        address indexed usdcToken,
        uint256 totalAmount,
        uint256 startTime,
        uint256 endTime,
        address attester
    );

    event RecipientAdded(bytes32 indexed budgetId, address indexed recipient, uint256 allocation);
    event AttestationSubmitted(
        bytes32 indexed budgetId,
        address indexed recipient,
        uint256 newEarned,
        uint256 attestationNonce,
        address indexed signer
    );
    event Withdrawn(bytes32 indexed budgetId, address indexed recipient, uint256 amount);
    event UnspentReclaimed(bytes32 indexed budgetId, address indexed owner, uint256 amount);

    error BudgetAlreadyExists();
    error BudgetNotFound();
    error NotBudgetOwner();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidTimeRange();
    error InvalidState();
    error AllocationExceeded();
    error InvalidSignature();
    error InvalidNonce();
    error NonMonotonicEarned();
    error NothingToWithdraw();
    error NothingToReclaim();
    error TokenTransferFailed();

    modifier onlyBudgetOwner(bytes32 budgetId) {
        if (budgets[budgetId].owner != msg.sender) revert NotBudgetOwner();
        _;
    }

    modifier budgetExists(bytes32 budgetId) {
        if (!budgets[budgetId].exists) revert BudgetNotFound();
        _;
    }

    function createBudget(
        bytes32 budgetId,
        address usdcToken,
        uint256 totalAmount,
        uint256 startTime,
        uint256 endTime,
        address attester
    ) external nonReentrant {
        if (budgets[budgetId].exists) revert BudgetAlreadyExists();
        if (msg.sender == address(0) || usdcToken == address(0) || attester == address(0)) revert InvalidAddress();
        if (totalAmount == 0) revert InvalidAmount();
        if (endTime <= startTime || startTime <= block.timestamp) revert InvalidTimeRange();

        uint256 balanceBefore = IERC20(usdcToken).balanceOf(address(this));
        if (!IERC20(usdcToken).transferFrom(msg.sender, address(this), totalAmount)) revert TokenTransferFailed();
        uint256 actualReceived = IERC20(usdcToken).balanceOf(address(this)) - balanceBefore;
        if (actualReceived == 0) revert InvalidAmount();

        budgets[budgetId] = Budget({
            owner: msg.sender,
            usdcToken: usdcToken,
            attester: attester,
            totalAmount: actualReceived,
            startTime: startTime,
            endTime: endTime,
            totalAllocated: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            reclaimedUnspent: 0,
            exists: true
        });

        emit BudgetCreated(budgetId, msg.sender, usdcToken, actualReceived, startTime, endTime, attester);
    }

    function addRecipient(
        bytes32 budgetId,
        address recipient,
        uint256 allocation
    ) external budgetExists(budgetId) onlyBudgetOwner(budgetId) {
        if (recipient == address(0)) revert InvalidAddress();
        if (allocation == 0) revert InvalidAmount();

        Budget storage budget = budgets[budgetId];
        BudgetState state = _state(budget);
        if (state == BudgetState.CLOSED) revert InvalidState();

        RecipientData storage recipientData = recipients[budgetId][recipient];

        uint256 newTotalAllocated = budget.totalAllocated - recipientData.allocation + allocation;
        if (newTotalAllocated > budget.totalAmount) revert AllocationExceeded();

        budget.totalAllocated = newTotalAllocated;
        recipientData.allocation = allocation;

        if (recipientData.earned > allocation) revert AllocationExceeded();

        emit RecipientAdded(budgetId, recipient, allocation);
    }

    function submitAttestation(
        bytes32 budgetId,
        address recipient,
        uint256 newEarned,
        uint256 attestationNonce,
        bytes calldata sig
    ) external budgetExists(budgetId) {
        if (recipient == address(0)) revert InvalidAddress();

        Budget storage budget = budgets[budgetId];
        if (_state(budget) != BudgetState.ACTIVE) revert InvalidState();

        RecipientData storage recipientData = recipients[budgetId][recipient];

        if (attestationNonce <= recipientData.lastAttestationNonce) revert InvalidNonce();
        if (newEarned < recipientData.earned) revert NonMonotonicEarned();
        if (newEarned > recipientData.allocation) revert AllocationExceeded();

        bytes32 message = keccak256(
            abi.encodePacked(budgetId, recipient, newEarned, attestationNonce, address(this), block.chainid)
        );
        bytes32 ethSignedMessage = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(ethSignedMessage, sig);
        if (signer != budget.attester) revert InvalidSignature();

        uint256 earnedDelta = newEarned - recipientData.earned;

        recipientData.earned = newEarned;
        recipientData.lastAttestationNonce = attestationNonce;
        budget.totalEarned += earnedDelta;

        emit AttestationSubmitted(budgetId, recipient, newEarned, attestationNonce, signer);
    }

    function withdraw(bytes32 budgetId) external nonReentrant budgetExists(budgetId) {
        Budget storage budget = budgets[budgetId];
        // Recipients can withdraw during ACTIVE or CLOSED; OPEN means the period hasn't started yet.
        if (_state(budget) == BudgetState.OPEN) revert InvalidState();

        RecipientData storage recipientData = recipients[budgetId][msg.sender];
        uint256 available = recipientData.earned - recipientData.withdrawn;
        if (available == 0) revert NothingToWithdraw();

        recipientData.withdrawn += available;
        budget.totalWithdrawn += available;

        if (!IERC20(budget.usdcToken).transfer(msg.sender, available)) revert TokenTransferFailed();

        emit Withdrawn(budgetId, msg.sender, available);
    }

    function reclaimUnspent(bytes32 budgetId)
        external
        nonReentrant
        budgetExists(budgetId)
        onlyBudgetOwner(budgetId)
    {
        Budget storage budget = budgets[budgetId];
        if (block.timestamp < budget.endTime) revert InvalidState();

        uint256 totalUnspent = budget.totalAmount - budget.totalEarned;
        uint256 reclaimable = totalUnspent - budget.reclaimedUnspent;
        if (reclaimable == 0) revert NothingToReclaim();

        budget.reclaimedUnspent += reclaimable;

        if (!IERC20(budget.usdcToken).transfer(msg.sender, reclaimable)) revert TokenTransferFailed();

        emit UnspentReclaimed(budgetId, msg.sender, reclaimable);
    }

    function getBudget(bytes32 budgetId)
        external
        view
        budgetExists(budgetId)
        returns (
            address owner,
            address usdcToken,
            uint256 totalAmount,
            uint256 startTime,
            uint256 endTime,
            address attester,
            uint256 totalEarned,
            uint256 totalWithdrawn,
            BudgetState state
        )
    {
        Budget storage budget = budgets[budgetId];

        return (
            budget.owner,
            budget.usdcToken,
            budget.totalAmount,
            budget.startTime,
            budget.endTime,
            budget.attester,
            budget.totalEarned,
            budget.totalWithdrawn,
            _state(budget)
        );
    }

    function getRecipient(bytes32 budgetId, address recipient)
        external
        view
        budgetExists(budgetId)
        returns (uint256 allocation, uint256 earned, uint256 withdrawn)
    {
        RecipientData storage recipientData = recipients[budgetId][recipient];
        return (recipientData.allocation, recipientData.earned, recipientData.withdrawn);
    }

    function _state(Budget storage budget) internal view returns (BudgetState) {
        if (block.timestamp < budget.startTime) {
            return BudgetState.OPEN;
        }
        if (block.timestamp < budget.endTime) {
            return BudgetState.ACTIVE;
        }
        return BudgetState.CLOSED;
    }
}
