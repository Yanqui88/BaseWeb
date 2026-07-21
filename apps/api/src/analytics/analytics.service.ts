import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';

export interface KpisResponse {
  revenue: number;
  ordersCount: number;
  averageTicket: number;
}

export interface SalesChartData {
  date: string;
  total: number;
}

export interface TopProduct {
  id: string;
  title: string;
  totalSold: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DbService) {}

  async getKpis(): Promise<KpisResponse> {
    const query = `
      SELECT
        COALESCE(SUM(total), 0) AS revenue,
        COUNT(id) AS orders_count,
        COALESCE(AVG(total), 0) AS average_ticket
      FROM orders
      WHERE payment_status = 'approved'
        AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `;
    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      revenue: parseFloat(row.revenue),
      ordersCount: parseInt(row.orders_count, 10),
      averageTicket: parseFloat(row.average_ticket),
    };
  }

  async getSalesChart(): Promise<SalesChartData[]> {
    const query = `
      SELECT
        date_trunc('day', created_at) AS date,
        COALESCE(SUM(total), 0) AS total
      FROM orders
      WHERE payment_status = 'approved'
        AND created_at >= (CURRENT_DATE - INTERVAL '30 days')
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const result = await this.db.query(query);

    return result.rows.map((row) => ({
      date: row.date,
      total: parseFloat(row.total),
    }));
  }

  async getTopProducts(): Promise<TopProduct[]> {
    const query = `
      SELECT
        p.id,
        p.title,
        SUM(oi.quantity) AS total_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.payment_status = 'approved'
      GROUP BY p.id, p.title
      ORDER BY total_sold DESC
      LIMIT 5
    `;
    const result = await this.db.query(query);

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      totalSold: parseInt(row.total_sold, 10),
    }));
  }
}
