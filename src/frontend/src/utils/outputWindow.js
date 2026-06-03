import { clampLineCount } from "./lineCount";

const OUTPUT_TEXT_FONT_SIZE_REM = 0.76;
const OUTPUT_TEXT_LINE_HEIGHT = 1.32;
const OUTPUT_SHELL_VERTICAL_PADDING_REM = 1.7;

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
  const lineHeightRem = OUTPUT_TEXT_FONT_SIZE_REM * OUTPUT_TEXT_LINE_HEIGHT;
  const minHeight = `${(
    normalizedMin * lineHeightRem + OUTPUT_SHELL_VERTICAL_PADDING_REM
  ).toFixed(3)}rem`;
  const maxHeight = `${(
    normalizedMax * lineHeightRem + OUTPUT_SHELL_VERTICAL_PADDING_REM
  ).toFixed(3)}rem`;

  return {
    "--ant-output-min-height": minHeight,
    "--ant-output-max-height": maxHeight,
    minHeight,
    maxHeight,
    overflowX: "auto",
    overflowY: "auto",
  };
}