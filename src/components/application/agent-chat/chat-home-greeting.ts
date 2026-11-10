/**
 * The home greeting: a short line for the time of day, in NekoPapa's voice
 * (an unhurried companion cat), instead of a bare 早上好 / 下午好. One line is
 * picked when the home opens and stays until it opens again. English pairs
 * live in the application copy table.
 */
export const homeGreetings = {
  dawn: ["夜深了，我还醒着。", "这么晚，想聊点什么？"],
  morning: ["早上好，今天慢慢来。", "新的一天，从哪儿开始？"],
  noon: ["中午好，记得吃饭。", "歇一会儿，再继续。"],
  afternoon: ["下午好，泡杯茶吧。", "午后正好，想点什么？"],
  evening: ["傍晚了，今天过得怎样？", "天快黑了，聊聊今天？"],
  night: ["晚上好，灯下慢慢聊。", "夜里安静，适合想事情。"],
} as const;

export type GreetingPeriod = keyof typeof homeGreetings;

export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour < 5) return "dawn";
  if (hour < 11) return "morning";
  if (hour < 14) return "noon";
  if (hour < 17) return "afternoon";
  if (hour < 19) return "evening";
  if (hour < 23) return "night";
  return "dawn";
}

/** `roll` is in [0, 1); callers pass Math.random(), tests pass fixed values. */
export function homeGreeting(hour: number, roll: number): string {
  const lines = homeGreetings[greetingPeriod(hour)];
  return lines[Math.min(lines.length - 1, Math.floor(roll * lines.length))];
}
