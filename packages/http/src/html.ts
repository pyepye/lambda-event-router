import type { Html as HtmlBody } from './types.js';

export type Html = HtmlBody;

/**
 * Marks a string as HTML for an HTML route. The matcher sends it as it is, so the template engine that made
 * it must escape any values it holds.
 */
// biome-ignore lint/suspicious/noRedeclare: TypeScript keeps the Html type and the Html function apart
export function Html(value: string): Html;
// biome-ignore lint/suspicious/noRedeclare: TypeScript keeps the Html type and the Html function apart
export function Html(value: Promise<string>): Promise<Html>;
export function Html(value: string | Promise<string>): Html | Promise<Html> {
  return value as Html | Promise<Html>;
}
