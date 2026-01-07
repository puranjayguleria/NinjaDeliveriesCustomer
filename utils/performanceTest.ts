// utils/performanceTest.ts
// Simple performance testing utilities

export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;
  private label: string;

  constructor(label: string) {
    this.label = label;
  }

  start(): void {
    this.startTime = performance.now();
    console.log(`[Performance] ${this.label} - Started`);
  }

  end(): number {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    console.log(`[Performance] ${this.label} - Completed in ${duration.toFixed(2)}ms`);
    return duration;
  }

  static measure<T>(label: string, fn: () => T): T {
    const timer = new PerformanceTimer(label);
    timer.start();
    const result = fn();
    timer.end();
    return result;
  }

  static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const timer = new PerformanceTimer(label);
    timer.start();
    const result = await fn();
    timer.end();
    return result;
  }
}

// Navigation performance tracking
export const trackNavigation = (screenName: string, startTime: number) => {
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`[Navigation] ${screenName} loaded in ${duration.toFixed(2)}ms`);
  
  // Log slow navigations
  if (duration > 1000) {
    console.warn(`[Navigation] Slow navigation to ${screenName}: ${duration.toFixed(2)}ms`);
  }
  
  return duration;
};

// Firestore query performance tracking
export const trackFirestoreQuery = (collection: string, queryType: string, startTime: number) => {
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`[Firestore] ${collection} ${queryType} completed in ${duration.toFixed(2)}ms`);
  
  // Log slow queries
  if (duration > 2000) {
    console.warn(`[Firestore] Slow query ${collection} ${queryType}: ${duration.toFixed(2)}ms`);
  }
  
  return duration;
};