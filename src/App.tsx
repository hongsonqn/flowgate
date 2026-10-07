import { useState } from 'react';
import { Layout } from './components/Layout';
import { LandingHero } from './components/LandingHero';
import { Dashboard } from './components/Dashboard';
import { CreateBudget } from './components/CreateBudget';
import { BudgetDetail } from './components/BudgetDetail';
import { RecipientView } from './components/RecipientView';
import { HowItWorks } from './components/HowItWorks';

type View = 'home' | 'dashboard' | 'create' | 'budget-detail' | 'recipient' | 'docs';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [activeBudgetId, setActiveBudgetId] = useState<string>('');

  function navigate(v: string, budgetId?: string) {
    if (budgetId) setActiveBudgetId(budgetId);
    setView(v as View);
  }

  const showNavView = view !== 'home';

  return (
    <Layout view={showNavView ? view : 'home'} onNavigate={navigate}>
      {view === 'home' && <LandingHero onNavigate={navigate} />}
      {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
      {view === 'create' && (
        <CreateBudget
          onCreated={(id) => {
            setActiveBudgetId(id);
            setView('dashboard');
          }}
        />
      )}
      {view === 'budget-detail' && activeBudgetId && (
        <BudgetDetail
          budgetIdHex={activeBudgetId}
          onBack={() => setView('dashboard')}
        />
      )}
      {view === 'recipient' && <RecipientView onNavigate={navigate} />}
      {view === 'docs' && <HowItWorks />}
    </Layout>
  );
}
