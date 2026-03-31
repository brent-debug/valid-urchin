export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    eventLimit: 10000,
    domainLimit: 1,
    features: [
      '1 domain',
      '10,000 events/month',
      '5 monitored parameters',
      'Community support'
    ]
  },
  starter: {
    name: 'Starter',
    price: 29,
    eventLimit: 100000,
    domainLimit: 3,
    features: [
      '3 domains',
      '100,000 events/month',
      'Unlimited parameters',
      'Email support'
    ]
  },
  pro: {
    name: 'Pro',
    price: 79,
    eventLimit: 500000,
    domainLimit: 10,
    features: [
      '10 domains',
      '500,000 events/month',
      'Unlimited parameters',
      'Conditional rules',
      'Priority support'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    eventLimit: null,
    domainLimit: null,
    features: [
      'Unlimited domains',
      'Unlimited events',
      'SSO',
      'Dedicated support',
      'SLA guarantee'
    ]
  }
}

export function getDomainLimit(plan) {
  return PLANS[plan]?.domainLimit ?? 1
}

export function getEventLimit(plan) {
  return PLANS[plan]?.eventLimit ?? 10000
}
