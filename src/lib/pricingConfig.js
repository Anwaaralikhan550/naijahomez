// lib/pricingConfig.js
export const PRICING_PLANS = {
  // Noticeboard is completely free
  noticeboard: {
    type: 'free',
    name: 'Noticeboard',
    description: 'Post community notices, events, and announcements for free',
    price: 0,
    currency: 'NGN',
    features: [
      'Unlimited notice postings',
      'Community events',
      'Local announcements',
      'Lost & found items'
    ]
  },

  // Tradespeople annual subscription
  tradespeople: {
    type: 'subscription',
    name: 'Tradespeople Services',
    description: 'Annual subscription for service providers',
    plans: [
      {
        id: 'tradespeople_basic',
        name: 'Basic Annual',
        price: 50000, // ₦50,000 per year
        currency: 'NGN',
        duration: 'annual',
        features: [
          'Unlimited service listings',
          'Business profile page',
          'Customer reviews',
          'Direct contact from customers',
          'Basic analytics'
        ]
      },
      {
        id: 'tradespeople_premium',
        name: 'Premium Annual',
        price: 100000, // ₦100,000 per year
        currency: 'NGN',
        duration: 'annual',
        features: [
          'Everything in Basic',
          'Featured listings',
          'Priority in search results',
          'Advanced analytics',
          'Custom business page',
          'WhatsApp integration'
        ]
      }
    ]
  },

  // Property advert bundles
  property: {
    type: 'bundle',
    name: 'Property Listings',
    description: 'Advertise your properties with flexible bundles',
    bundles: [
      {
        id: 'property_1',
        name: '1 Property Ad',
        count: 1,
        price: 5000,
        currency: 'NGN',
        validity: 90, // 90 days
        features: ['Standard listing', 'Up to 10 photos', '90 days visibility']
      },
      {
        id: 'property_5',
        name: '5 Property Ads',
        count: 5,
        price: 20000,
        currency: 'NGN',
        validity: 90,
        discount: 20,
        features: ['Standard listing', 'Up to 10 photos each', '90 days visibility', '20% discount']
      },
      {
        id: 'property_10',
        name: '10 Property Ads',
        count: 10,
        price: 35000,
        currency: 'NGN',
        validity: 90,
        discount: 30,
        features: ['Standard listing', 'Up to 10 photos each', '90 days visibility', '30% discount']
      },
      {
        id: 'property_20',
        name: '20 Property Ads',
        count: 20,
        price: 60000,
        currency: 'NGN',
        validity: 90,
        discount: 40,
        features: ['Standard listing', 'Up to 10 photos each', '90 days visibility', '40% discount', 'Priority support']
      },
      {
        id: 'property_50',
        name: '50 Property Ads',
        count: 50,
        price: 125000,
        currency: 'NGN',
        validity: 90,
        discount: 50,
        features: ['Standard listing', 'Up to 10 photos each', '90 days visibility', '50% discount', 'Priority support', 'Featured listings']
      },
      {
        id: 'property_unlimited',
        name: 'Unlimited Property Ads',
        count: -1, // -1 represents unlimited
        price: 200000,
        currency: 'NGN',
        validity: 365, // 1 year
        discount: 60,
        features: ['Unlimited listings', 'Up to 15 photos each', '1 year validity', 'Featured listings', 'Priority support', 'Analytics dashboard']
      }
    ]
  },

  // Marketplace advert bundles
  marketplace: {
    type: 'bundle',
    name: 'Marketplace Listings',
    description: 'Sell your items with flexible ad bundles',
    bundles: [
      {
        id: 'marketplace_1',
        name: '1 Marketplace Ad',
        count: 1,
        price: 2000,
        currency: 'NGN',
        validity: 60, // 60 days
        features: ['Standard listing', 'Up to 8 photos', '60 days visibility']
      },
      {
        id: 'marketplace_5',
        name: '5 Marketplace Ads',
        count: 5,
        price: 8000,
        currency: 'NGN',
        validity: 60,
        discount: 20,
        features: ['Standard listing', 'Up to 8 photos each', '60 days visibility', '20% discount']
      },
      {
        id: 'marketplace_10',
        name: '10 Marketplace Ads',
        count: 10,
        price: 14000,
        currency: 'NGN',
        validity: 60,
        discount: 30,
        features: ['Standard listing', 'Up to 8 photos each', '60 days visibility', '30% discount']
      },
      {
        id: 'marketplace_20',
        name: '20 Marketplace Ads',
        count: 20,
        price: 24000,
        currency: 'NGN',
        validity: 60,
        discount: 40,
        features: ['Standard listing', 'Up to 8 photos each', '60 days visibility', '40% discount', 'Priority support']
      },
      {
        id: 'marketplace_50',
        name: '50 Marketplace Ads',
        count: 50,
        price: 50000,
        currency: 'NGN',
        validity: 60,
        discount: 50,
        features: ['Standard listing', 'Up to 8 photos each', '60 days visibility', '50% discount', 'Priority support', 'Featured listings']
      },
      {
        id: 'marketplace_unlimited',
        name: 'Unlimited Marketplace Ads',
        count: -1,
        price: 80000,
        currency: 'NGN',
        validity: 365,
        discount: 60,
        features: ['Unlimited listings', 'Up to 12 photos each', '1 year validity', 'Featured listings', 'Priority support', 'Sales analytics']
      }
    ]
  },

  // Housemate advert bundles
  housemate: {
    type: 'bundle',
    name: 'Housemate Listings',
    description: 'Find housemates or rent out rooms with ad bundles',
    bundles: [
      {
        id: 'housemate_1',
        name: '1 Housemate Ad',
        count: 1,
        price: 3000,
        currency: 'NGN',
        validity: 60, // 60 days
        features: ['Standard listing', 'Up to 6 photos', '60 days visibility']
      },
      {
        id: 'housemate_5',
        name: '5 Housemate Ads',
        count: 5,
        price: 12000,
        currency: 'NGN',
        validity: 60,
        discount: 20,
        features: ['Standard listing', 'Up to 6 photos each', '60 days visibility', '20% discount']
      },
      {
        id: 'housemate_10',
        name: '10 Housemate Ads',
        count: 10,
        price: 21000,
        currency: 'NGN',
        validity: 60,
        discount: 30,
        features: ['Standard listing', 'Up to 6 photos each', '60 days visibility', '30% discount']
      },
      {
        id: 'housemate_20',
        name: '20 Housemate Ads',
        count: 20,
        price: 36000,
        currency: 'NGN',
        validity: 60,
        discount: 40,
        features: ['Standard listing', 'Up to 6 photos each', '60 days visibility', '40% discount', 'Priority support']
      },
      {
        id: 'housemate_50',
        name: '50 Housemate Ads',
        count: 50,
        price: 75000,
        currency: 'NGN',
        validity: 60,
        discount: 50,
        features: ['Standard listing', 'Up to 6 photos each', '60 days visibility', '50% discount', 'Priority support', 'Featured listings']
      },
      {
        id: 'housemate_unlimited',
        name: 'Unlimited Housemate Ads',
        count: -1,
        price: 120000,
        currency: 'NGN',
        validity: 365,
        discount: 60,
        features: ['Unlimited listings', 'Up to 10 photos each', '1 year validity', 'Featured listings', 'Priority support', 'Tenant screening tools']
      }
    ]
  }
};

// FCMB Bank Details for payments
export const BANK_DETAILS = {
  name: 'First City Monument Bank (FCMB)',
  accountName: 'NIJAHOMZS LIMITED',
  accountNumber: '1234567890', // Replace with actual account number
  bankCode: '214',
  sortCode: '214150149', // Replace with actual sort code
  swiftCode: 'FCMBNGLA',
  branch: 'Victoria Island Branch, Lagos'
};

// Payment methods configuration
export const PAYMENT_METHODS = {
  bank_transfer: {
    name: 'Bank Transfer',
    description: 'Direct bank transfer to FCMB account',
    icon: 'bank',
    enabled: true,
    instructions: [
      'Transfer the exact amount to the account details provided',
      'Use your order reference as the payment description',
      'Upload proof of payment',
      'Your ads will be activated within 2-4 hours after verification'
    ]
  },
  paystack: {
    name: 'Card Payment',
    description: 'Pay with debit/credit card via Paystack',
    icon: 'credit-card',
    enabled: true,
    instructions: [
      'Secure payment via Paystack',
      'Instant activation after successful payment',
      'Accepts all major Nigerian banks'
    ]
  }
};

// Utility functions
export const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0
  }).format(amount);
};

export const calculateSavings = (originalPrice, discountedPrice) => {
  return originalPrice - discountedPrice;
};

export const getPlanById = (type, planId) => {
  const category = PRICING_PLANS[type];
  if (!category) return null;
  
  if (category.type === 'bundle') {
    return category.bundles.find(bundle => bundle.id === planId);
  } else if (category.type === 'subscription') {
    return category.plans.find(plan => plan.id === planId);
  }
  
  return null;
};

export const getUserAdLimit = (userPlan, adType) => {
  if (adType === 'noticeboard') return -1; // Unlimited for free
  
  if (!userPlan || !userPlan[adType]) return 0;
  
  const plan = userPlan[adType];
  if (plan.count === -1) return -1; // Unlimited
  
  return Math.max(0, plan.count - (plan.used || 0));
};

export const canUserPostAd = (userPlan, adType) => {
  if (adType === 'noticeboard') return true; // Always free
  
  const limit = getUserAdLimit(userPlan, adType);
  return limit === -1 || limit > 0;
};