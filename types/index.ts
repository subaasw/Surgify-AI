export type Scenario = {
  id: string;
  name: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  duration: number;
  skills: string[];
  progress: number;
  image?: string;
};

export type SessionMetric = {
  accuracy: number;
  efficiency: number;
  stability: number;
  sequence: number;
  safety: number;
  completionTime: number;
};

export type MistakeEvent = {
  timestamp: number;
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
};

export type TrainingSession = {
  id: string;
  scenarioId: string;
  date: string;
  score: number;
  duration: number;
  metrics: SessionMetric;
  mistakes: MistakeEvent[];
};

export type AnatomyLayer = {
  id: "skin" | "muscles" | "skeleton" | "brain" | "heart" | "lungs" | "kidney" | "liver" | "stomach";
  name: string;
  color: string;
  description: string;
  relevance: string;
};
