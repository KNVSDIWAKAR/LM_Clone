import JourneyDashboard from "../components/journey/JourneyDashboard";
import DataSourcesPanel from "../components/journey/DataSourcesPanel";

const withDataSources = (dashboard) => <DataSourcesPanel sources={dashboard.dataSources} />;

export const RetentionEligibility = () => <JourneyDashboard journeyId="loss-mit" customPanel={withDataSources} />;
export const IntakeDocReview = () => <JourneyDashboard journeyId="loss-mit-intake" customPanel={withDataSources} />;
export const TrialMonitoring = () => <JourneyDashboard journeyId="loss-mit-trial" />;
export const TrialUnderwriting = () => <JourneyDashboard journeyId="loss-mit-trial-uw" />;
export const FinalModClosing = () => <JourneyDashboard journeyId="loss-mit-closing" />;
