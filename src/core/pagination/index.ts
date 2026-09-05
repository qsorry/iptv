import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  data: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export const offsetOf = ({ page, perPage }: Pagination) => (page - 1) * perPage;

export function paginate<T>(data: T[], total: number, p: Pagination): Paginated<T> {
  return { data, page: p.page, perPage: p.perPage, total, totalPages: Math.ceil(total / p.perPage) };
}
