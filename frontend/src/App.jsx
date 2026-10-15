import { Route, Switch } from "wouter";
import AppLayout from "./components/layout/AppLayout";
import AgentConsole from "./pages/AgentConsole";
import AgentRuns from "./pages/AgentRuns";
import AgentStudio from "./pages/AgentStudio";
import AuditTrail from "./pages/AuditTrail";
import CommandCenter from "./pages/CommandCenter";
import Compliance from "./pages/Compliance";
import DecisionDetail from "./pages/DecisionDetail";
import DecisionInbox from "./pages/DecisionInbox";
import Integrations from "./pages/Integrations";
import KnowledgeBase from "./pages/KnowledgeBase";
import LossMitigationDashboard from "./pages/LossMitigationDashboard";
import LossMitigationEndToEnd from "./pages/LossMitigationEndToEnd";
import NotFound from "./pages/NotFound";
import SkillsManager from "./pages/SkillsManager";
import {
  FinalModClosing,
  IntakeDocReview,
  RetentionEligibility,
  TrialMonitoring,
  TrialUnderwriting,
} from "./pages/JourneyPages";

export default function App() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={CommandCenter} />
        <Route path="/agent-console" component={AgentConsole} />
        <Route path="/loss-mitigation" component={LossMitigationEndToEnd} />
        <Route path="/loss-mitigation-dashboard" component={LossMitigationDashboard} />
        <Route path="/loss-mit-intake" component={IntakeDocReview} />
        <Route path="/loss-mit" component={RetentionEligibility} />
        <Route path="/loss-mit-trial-uw" component={TrialUnderwriting} />
        <Route path="/loss-mit-trial" component={TrialMonitoring} />
        <Route path="/loss-mit-closing" component={FinalModClosing} />
        <Route path="/agent-studio" component={AgentStudio} />
        <Route path="/skills-manager" component={SkillsManager} />
        <Route path="/knowledge-base" component={KnowledgeBase} />
        <Route path="/integrations" component={Integrations} />
        {/* keyed so navigating between decisions resets local form state */}
        <Route path="/decision-inbox/:id">{(params) => <DecisionDetail key={params.id} />}</Route>
        <Route path="/decision-inbox" component={DecisionInbox} />
        <Route path="/agent-runs" component={AgentRuns} />
        <Route path="/compliance" component={Compliance} />
        <Route path="/audit-trail" component={AuditTrail} />
        <Route>
          <NotFound title="Page Not Found" />
        </Route>
      </Switch>
    </AppLayout>
  );
}
