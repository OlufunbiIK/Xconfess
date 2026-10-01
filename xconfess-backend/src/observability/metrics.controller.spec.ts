import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsController } from './metrics.controller';
import { OperationalMetricsService } from './operational-metrics.service';

describe('MetricsController', () => {
  it('returns the Prometheus text from the metrics service', () => {
    const metrics = new OperationalMetricsService();
    metrics.recordFeedQuery('public', 'success', 0.01);
    const controller = new MetricsController(metrics);

    expect(controller.getMetrics()).toContain(
      'xconfess_feed_queries_total{feed_type="public",outcome="success"} 1',
    );
  });

  it('is restricted to authenticated admins', () => {
    const guards: unknown[] = Reflect.getMetadata(
      GUARDS_METADATA,
      MetricsController.prototype.getMetrics,
    );
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, AdminGuard]));
  });
});
