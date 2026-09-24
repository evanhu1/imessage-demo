// iOS 26 Messages, light mode. Units are iOS points; the screen is zoomed to 1080px wide.
export const PT_WIDTH = 402; // iPhone 16/17 Pro
export const SCALE = 1080 / PT_WIDTH;

export const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", system-ui, "Apple Color Emoji", sans-serif';

export const C = {
  blue: '#0A7CFF',
  gray: '#E9E9EB',
  label: '#000000',
  secondary: '#8E8E93',
  tertiary: 'rgba(60,60,67,0.3)',
  bg: '#FFFFFF',
  heart: '#FF5AA8',
  emphasize: '#F2273A',
};

export const M = {
  sideMargin: 14, // screen edge to the bubble's tail edge
  maxBubble: 0.72, // max bubble width as a fraction of the screen
  groupGap: 2, // between bubbles from the same sender
  senderGap: 10, // when the sender changes
  radius: 18,
  fontSize: 17,
  lineHeight: 20.3, // SF Pro 17pt natural line height
  padV: 9,
  padH: 13.5,
  headerHeight: 162, // status bar + nav, content scrolls under it
  inputBottom: 14.5, // distance from the screen bottom to the input bar bottom
  inputHeight: 39,
};
