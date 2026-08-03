/** Fixed-id walk-in / non-member customer used for non-loyalty sales. */
export const NON_MEMBER_CUSTOMER_ID = "cust-customer2";

export const NON_MEMBER_CUSTOMER_NAME = "customer2";

export function isNonMemberCustomer(customerId: string): boolean {
  return customerId === NON_MEMBER_CUSTOMER_ID;
}
