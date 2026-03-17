type Use<T> = (value: T) => Promise<void>;

export type FixtureMap<T> = {
  [K in keyof T]: (context: { task: unknown }, use: Use<T[K]>) => Promise<void>;
};

export function fixture<T>(creator: T) {
  return async ({ task: _task }: { task: unknown }, use: Use<T>): Promise<void> => {
    await use(creator);
  };
}
