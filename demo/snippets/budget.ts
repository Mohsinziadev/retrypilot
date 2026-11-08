import { RetryBudget } from "retrypilot";

// Each retry spends 1 token, each success earns 0.1 back. When the bucket is empty,
// retries stop for every call that shares it: an outage cannot triple your traffic.
export const budget = new RetryBudget({ capacity: 20, retryCost: 1, successRefund: 0.1 });
