import { createContext, useContext } from "react";
import type {
  TutorialAction,
  TutorialChapterId,
  TutorialProgress,
} from "./tutorialModel";

export interface TutorialContextValue {
  readonly progress: TutorialProgress | null;
  readonly startChapter: (id: TutorialChapterId) => Promise<void>;
  readonly reportAction: (action: TutorialAction, chartId?: string) => void;
  readonly nextStep: () => void;
  readonly previousStep: () => void;
  readonly skipStep: () => void;
  readonly pause: () => void;
  readonly deletePracticeChart: () => Promise<void>;
  readonly keepPracticeChart: () => void;
}

export const TutorialContext = createContext<TutorialContextValue | null>(null);

const tutorialFallback: TutorialContextValue = {
  progress: null,
  startChapter: () => Promise.resolve(),
  reportAction: () => {},
  nextStep: () => {},
  previousStep: () => {},
  skipStep: () => {},
  pause: () => {},
  deletePracticeChart: () => Promise.resolve(),
  keepPracticeChart: () => {},
};

export function useTutorial() {
  return useContext(TutorialContext) ?? tutorialFallback;
}
