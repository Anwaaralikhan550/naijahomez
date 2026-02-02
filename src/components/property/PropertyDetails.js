// src/components/property/PropertyDetails.js
import { Bed, Bath, Car, Home } from 'lucide-react';

export default function PropertyDetails({ details }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-blue-900 mb-6 border-b pb-4">
        Property Details
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { icon: Bed, label: 'Bedrooms', value: details.bedrooms },
          { icon: Bath, label: 'Bathrooms', value: details.bathrooms },
          { icon: Home, label: 'Square Meters', value: details.squareMeters },
          { icon: Car, label: 'Parking Spaces', value: details.parkingSpaces }
        ].map((detail, index) => (
          detail.value && detail.value !== 'none' && (
            <div 
              key={index} 
              className="flex items-center bg-blue-50 p-3 md:p-4 rounded-lg"
            >
              <div className="bg-blue-500 text-white p-2 md:p-3 rounded-full mr-3">
                <detail.icon size={18} />
              </div>
              <div>
                <p className="text-gray-600 text-sm">{detail.label}</p>
                <p className="font-semibold text-blue-900">{detail.value}</p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}