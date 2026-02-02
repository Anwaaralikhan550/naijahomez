'use client';

import React from 'react';
import { CheckCircle, MapPin, Briefcase, Users, Globe } from 'lucide-react';

export default function AboutUsPage() {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <div 
        className="relative py-20"
        style={{
          backgroundImage: "linear-gradient(rgba(0, 63, 136, 0.8), rgba(0, 83, 166, 0.9)), url('/mosaic-banner.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            About Nijahomzs
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Your comprehensive platform for properties, marketplace items, and professional services in Nigeria.
          </p>
        </div>
      </div>

      {/* Welcome Videos Section */}
      <div className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center">
            Welcome to Nijahomzs
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* First Video */}
            <div className="relative pt-[56.25%] rounded-xl overflow-hidden shadow-lg">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/XhuvSqoEf4U"
                title="Welcome to Nijahomzs"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Second Video */}
            <div className="relative pt-[56.25%] rounded-xl overflow-hidden shadow-lg">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/1cRrEggSUq0"
                title="How Nijahomzs Works"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>

      {/* Our Story Section */}
      <div className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="md:flex items-center gap-12">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h2 className="text-3xl font-bold text-blue-900 mb-6">Our Story</h2>
              <p className="text-gray-700 mb-6">
                Nijahomzs was founded in 2023 with a simple mission: to create a comprehensive platform that connects Nigerians with properties, products, and services they need. We recognized the challenges faced by both buyers and sellers in Nigeria's fragmented marketplace and set out to build a solution.
              </p>
              <p className="text-gray-700 mb-6">
                Our founders combined their expertise in real estate, technology, and customer service to develop a platform that simplifies the process of finding and listing properties, buying and selling items, and connecting with skilled professionals across Nigeria.
              </p>
              <p className="text-gray-700">
                Today, Nijahomzs has grown to become a trusted platform serving thousands of Nigerians every day, facilitating connections and transactions in properties, marketplace goods, and professional services.
              </p>
            </div>
            <div className="md:w-1/2">
              <div className="relative rounded-xl overflow-hidden shadow-xl h-[400px]">
                <img 
                  src="/api/placeholder/600/400" 
                  alt="Nijahomzs Team" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Our Mission Section */}
      <div className="py-16 bg-blue-50">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-blue-900 mb-4">Our Mission</h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-12">
            To create a platform that simplifies finding and offering properties, products, and services while building a more connected community across Nigeria.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-blue-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">Quality & Trust</h3>
              <p className="text-gray-600">
                We're committed to ensuring quality listings and trusted interactions. We verify our users and provide tools for safe transactions.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="text-blue-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">Community First</h3>
              <p className="text-gray-600">
                We prioritize building a supportive community where buyers, sellers, property owners, and service providers can connect and thrive.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="text-blue-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">Nationwide Access</h3>
              <p className="text-gray-600">
                We're expanding across Nigeria to provide access to properties, products, and services no matter where you are in the country.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Our Values Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center">Our Values</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Transparency',
                description: 'We believe in clear, honest communication with our users and within our team.'
              },
              {
                title: 'Innovation',
                description: 'We continuously improve our platform to better serve the evolving needs of Nigerians.'
              },
              {
                title: 'Integrity',
                description: 'We maintain the highest ethical standards in all our operations and interactions.'
              },
              {
                title: 'Empowerment',
                description: 'We aim to empower individuals and businesses to achieve their goals through our platform.'
              }
            ].map((value, index) => (
              <div key={index} className="flex gap-4 items-start">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="text-blue-500 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-blue-900 mb-2">{value.title}</h3>
                  <p className="text-gray-600">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-16 bg-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Join the Nijahomzs Community</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Find your perfect property, buy and sell items, or connect with skilled professionals. Start your journey with Nijahomzs today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/property"
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Browse Properties
            </a>
            <a
              href="/dashboard?tab=post-ad"
              className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              Post an Ad
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}