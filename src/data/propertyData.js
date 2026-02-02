// data/propertyData.js

export const properties = [
    {
      id: 1,
      title: "4 bedroom house for rent",
      phoneNumber: 7040472728,
      location: "Oral Estate Extension, Lekki, Lagos",
      rate: "₦3,500,000",
      period: "per month",
      bedrooms: 4,
      bathrooms: 4,
      toilets: 5,
      parkingSpaces: null,
      squareMeters: null,
      type: "house",
      description: "Luxury 4-Bedroom Detached Duplex with Private Pool – Monthly Lease Available"
    },
    {
      id: 2,
      title: "4 bedroom house for rent",
      phoneNumber: 8082163583,
      location: "Lekki Phase 1, Lekki, Lagos",
      rate: "₦18,000,000",
      period: "per annum",
      bedrooms: 4,
      bathrooms: 4,
      toilets: 5,
      parkingSpaces: null,
      squareMeters: null,
      type: "house",
      description: "Luxury 4-Bedroom Semi-Detached House in prestigious Lekki Phase 1"
    },
    {
      id: 3,
      title: "2 bedroom flat / apartment for rent",
      phoneNumber: 9112749918,
      location: "Ikate, Ikate, Lekki, Lagos",
      rate: "₦8,000,000",
      period: "per annum",
      bedrooms: 2,
      bathrooms: 2,
      toilets: 3,
      parkingSpaces: 2,
      squareMeters: null,
      type: "apartment",
      description: "Luxury 2-Bedroom Apartment with Exquisite Finishes"
    },
    {
      id: 4,
      title: "Office space for rent",
      phoneNumber: 8023729528,
      location: "Dolphin Extension, Ikoyi, Lagos",
      rate: "₦45,000,000",
      period: "per annum",
      bedrooms: null,
      bathrooms: 6,
      toilets: 7,
      parkingSpaces: null,
      squareMeters: null,
      type: "office",
      description: "Luxury 6-Bedroom Detached Duplex in Dolphin Estate Extension"
    },
    {
      id: 5,
      title: "4 bedroom detached duplex for rent",
      phoneNumber: 7030480818,
      location: "By Cedarcrest Hospital Apo Duste, Apo, Abuja",
      rate: "₦6,000,000",
      period: "per annum",
      bedrooms: 4,
      bathrooms: 4,
      toilets: 5,
      parkingSpaces: 5,
      squareMeters: null,
      type: "duplex",
      description: "Fully Detached 4-Bedroom Duplex with 2-Room BQ"
    },
    {
      id: 6,
      title: "3 bedroom flat / apartment for rent",
      phoneNumber: 8158849886,
      location: "Utako, Abuja",
      rate: "₦7,000,000",
      period: "per annum",
      bedrooms: 3,
      bathrooms: 3,
      toilets: 4,
      parkingSpaces: 3,
      squareMeters: null,
      type: "apartment",
      description: "3-Bedroom Flat in Utako: Luxurious Living, Prime Location"
    }
    // ... add more properties as needed
  ];
  
  export const propertyTypes = [
    { id: 'house', label: 'House' },
    { id: 'apartment', label: 'Apartment' },
    { id: 'duplex', label: 'Duplex' },
    { id: 'office', label: 'Office Space' }
  ];
  
  export const locations = [
    'Lekki',
    'Ikoyi',
    'Abuja',
    'Lagos',
    'Ikate',
    'Utako'
  ].sort();
  
  // Helper function to format currency
  export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Helper function to parse currency string to number
  export const parseCurrency = (currencyString) => {
    return parseInt(currencyString.replace(/[^\d]/g, ''));
  };