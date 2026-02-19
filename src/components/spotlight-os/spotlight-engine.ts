import { addFirstContentStep, analyzeFlowStep, commandOsStep, decisionLabStep, planPublicationStep } from "./spotlight-steps";
import { SPOTLIGHT_VERSION, type SpotlightFlow, type SpotlightFlowInput, type SpotlightStep } from "./spotlight-types";

function capSteps(steps: SpotlightStep[]): SpotlightStep[] {
  return steps.slice(0, 4);
}

export function deriveSpotlightFlow(input: SpotlightFlowInput): SpotlightFlow {
  const steps: SpotlightStep[] = [];

  if (!input.hasContent) {
    steps.push(addFirstContentStep());
    steps.push(planPublicationStep());
    steps.push(analyzeFlowStep());
    if (input.hasCommandOS) {
      steps.push(commandOsStep());
    }
  } else if (!input.hasPublications) {
    steps.push(planPublicationStep());
    steps.push(analyzeFlowStep());

    if (input.hasSignals && input.hasDecisionLab && input.decisionLabReady) {
      steps.push(decisionLabStep());
    } else if (input.hasCommandOS) {
      steps.push(commandOsStep());
    }
  } else {
    steps.push(analyzeFlowStep());

    if (input.hasSignals && input.hasDecisionLab && input.decisionLabReady) {
      steps.push(decisionLabStep());
    }

    if (input.hasCommandOS) {
      steps.push(commandOsStep());
    }
  }

  const finalSteps = capSteps(steps);

  return {
    steps: finalSteps,
    version: SPOTLIGHT_VERSION,
    totalSteps: finalSteps.length,
  };
}
