import { clampLineCount } from "./lineCount";

export function getOutputWindowLines(visualizer = {}) {
  const minLines = clampLineCount(visualizer.output_min_lines ?? 2, 1, 200, 2);
  const maxLines = Math.max(
    minLines,
    clampLineCount(visualizer.output_max_lines ?? 12, 1, 500, 12)
  );

  return { minLines, maxLines };
}

export function buildOutputWindowStyle(minLines, maxLines) {
  const normalizedMin = Math.max(1, Number(minLines) || 2);
  const normalizedMax = Math.max(normalizedMin, Number(maxLines) || 12);
  const lineHeightEm = 1.5;
  const verticalPaddingEm = 1.7;
  const minHeight = `${(normalizedMin * lineHeightEm + verticalPaddingEm).toFixed(2)}em`;
  const maxHeight = `${(normalizedMax * lineHeightEm + verticalPaddingEm).toFixed(2)}em`;

  return {
    "--ant-output-min-height": minHeight,
    "--ant-output-max-height": maxHeight,
    minHeight,
    maxHeight,
    overflowX: "auto",
    overflowY: "auto",
  };
}