// src/lib/configurator/types/cart.ts

export type PaymentStatus = 'reservation_paid' | 'balance_pending' | 'fully_paid';

export interface Order {
  reservationFeePaid: 499; // INR, fixed
  orderTotal: number;
  balanceDue: number; // orderTotal - reservationFeePaid
  paymentStatus: PaymentStatus;
}