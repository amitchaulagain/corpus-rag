export type HumanCalibrationSample = {
  sampleId: string;
  criticOverall: number;
  humanOverall: number;
  notes: string;
};

// Small seed dataset from manual review sessions. This is intentionally tiny and
// should be extended over time as you collect real reviewer scores.
export const COVER_LETTER_HUMAN_CALIBRATION_DATASET: HumanCalibrationSample[] = [
  {
    sampleId: 'cl-001',
    criticOverall: 92,
    humanOverall: 86,
    notes: 'Technically aligned but still sounded templated.'
  },
  {
    sampleId: 'cl-002',
    criticOverall: 88,
    humanOverall: 84,
    notes: 'Good relevance, weak narrative flow.'
  },
  {
    sampleId: 'cl-003',
    criticOverall: 95,
    humanOverall: 90,
    notes: 'Strong evidence, slightly verbose.'
  },
  {
    sampleId: 'cl-004',
    criticOverall: 84,
    humanOverall: 82,
    notes: 'Acceptable but generic opening.'
  },
  {
    sampleId: 'cl-005',
    criticOverall: 97,
    humanOverall: 93,
    notes: 'Excellent alignment and evidence usage.'
  }
];

export function calibrateCriticOverall(rawCriticOverall: number): {
  calibratedOverall: number;
  biasAdjustment: number;
  datasetSize: number;
} {
  const valid = COVER_LETTER_HUMAN_CALIBRATION_DATASET.filter(
    (item) =>
      Number.isFinite(item.criticOverall) &&
      Number.isFinite(item.humanOverall)
  );
  if (valid.length === 0) {
    const passthrough = Math.max(0, Math.min(100, Math.round(rawCriticOverall)));
    return {
      calibratedOverall: passthrough,
      biasAdjustment: 0,
      datasetSize: 0
    };
  }

  const totalDelta = valid.reduce(
    (acc, item) => acc + (item.humanOverall - item.criticOverall),
    0
  );
  const avgDelta = totalDelta / valid.length;
  const calibrated = Math.max(
    0,
    Math.min(100, Math.round(rawCriticOverall + avgDelta))
  );

  return {
    calibratedOverall: calibrated,
    biasAdjustment: Number(avgDelta.toFixed(2)),
    datasetSize: valid.length
  };
}
