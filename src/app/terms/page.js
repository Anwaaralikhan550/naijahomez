'use client';

import React from 'react';
import { FileText, Clock, Shield, AlertTriangle, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Please read these terms carefully before using the Nijahomzs platform.
          </p>
        </div>
      </div>

      {/* Last Updated Section */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center text-gray-600">
            <Clock className="mr-2" size={18} />
            <span>Last Updated: March 15, 2025</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          {/* Table of Contents */}
          <div className="mb-12 p-6 bg-gray-50 rounded-xl">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">Table of Contents</h2>
            <ul className="space-y-2">
              <li>
                <a href="#introduction" className="text-blue-600 hover:underline">1. Introduction</a>
              </li>
              <li>
                <a href="#eligibility" className="text-blue-600 hover:underline">2. Eligibility</a>
              </li>
              <li>
                <a href="#accounts" className="text-blue-600 hover:underline">3. User Accounts</a>
              </li>
              <li>
                <a href="#listings" className="text-blue-600 hover:underline">4. Listings and Transactions</a>
              </li>
              <li>
                <a href="#prohibited" className="text-blue-600 hover:underline">5. Prohibited Activities</a>
              </li>
              <li>
                <a href="#intellectual" className="text-blue-600 hover:underline">6. Intellectual Property</a>
              </li>
              <li>
                <a href="#liability" className="text-blue-600 hover:underline">7. Limitation of Liability</a>
              </li>
              <li>
                <a href="#disputes" className="text-blue-600 hover:underline">8. Dispute Resolution</a>
              </li>
              <li>
                <a href="#termination" className="text-blue-600 hover:underline">9. Termination</a>
              </li>
              <li>
                <a href="#changes" className="text-blue-600 hover:underline">10. Changes to Terms</a>
              </li>
              <li>
                <a href="#contact" className="text-blue-600 hover:underline">11. Contact Us</a>
              </li>
            </ul>
          </div>

          {/* Introduction */}
          <div className="prose max-w-none mb-12" id="introduction">
            <h2>1. Introduction</h2>
            <p>
              Welcome to Nijahomzs, a platform that connects individuals looking to buy, sell, or rent properties, marketplace items, and professional services in Nigeria. These Terms of Service ("Terms") govern your use of the Nijahomzs website, mobile applications, and services (collectively, the "Service").
            </p>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service. These Terms constitute a legal agreement between you and Nijahomzs, and you must agree to and accept all of the Terms, or you don't have the right to use the Service.
            </p>
          </div>

          {/* Eligibility */}
          <div className="prose max-w-none mb-12" id="eligibility">
            <h2>2. Eligibility</h2>
            <p>
              To use the Service, you must be at least 18 years old and capable of forming a binding contract with Nijahomzs. By using the Service, you represent and warrant that you meet these requirements. If you are using the Service on behalf of a company or other legal entity, you represent that you have the authority to bind that entity to these Terms.
            </p>
          </div>

          {/* User Accounts */}
          <div className="prose max-w-none mb-12" id="accounts">
            <h2>3. User Accounts</h2>
            <p>
              When you create an account with us, you must provide accurate, complete, and current information. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
            </p>
            <p>
              You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
            </p>
            <p>
              You may not use as a username the name of another person or entity that is not lawfully available for use, or a name or trademark that is subject to any rights of another person or entity without appropriate authorization. You may not use a username that is offensive, vulgar, or obscene.
            </p>
          </div>

          {/* Listings and Transactions */}
          <div className="prose max-w-none mb-12" id="listings">
            <h2>4. Listings and Transactions</h2>
            <p>
              Nijahomzs is a platform that allows users to list and browse properties, goods, and services. When you create a listing, you are responsible for ensuring that your listing complies with all applicable laws and regulations.
            </p>
            
            <h3>4.1 Listing Content</h3>
            <p>
              You are solely responsible for the content of your listings, including descriptions, images, pricing, and other details. Listings must be accurate, truthful, and not misleading. Nijahomzs reserves the right to remove or modify listings that do not comply with these Terms or our community guidelines.
            </p>
            
            <h3>4.2 Transactions</h3>
            <p>
              Nijahomzs is not a party to any transaction between users. We do not control, guarantee, or assume responsibility for the quality, safety, legality, or accuracy of listings or the ability of users to complete transactions. Users engage in transactions at their own risk.
            </p>
            
            <h3>4.3 Fees</h3>
            <p>
              Nijahomzs may charge fees for certain services or features. We will notify you of applicable fees before you incur them. All fees are non-refundable unless otherwise specified. We reserve the right to change our fee structure at any time.
            </p>
          </div>

          {/* Prohibited Activities */}
          <div className="prose max-w-none mb-12" id="prohibited">
            <h2>5. Prohibited Activities</h2>
            <p>
              When using the Service, you agree not to:
            </p>
            <ul>
              <li>Violate any laws or regulations</li>
              <li>Infringe upon the rights of others, including intellectual property rights</li>
              <li>Post false, inaccurate, misleading, deceptive, or defamatory content</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Interfere with or disrupt the Service or servers or networks connected to the Service</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use the Service to send unsolicited communications or "spam"</li>
              <li>Post or list prohibited items, including but not limited to: illegal drugs, weapons, counterfeit goods, or stolen property</li>
              <li>Engage in fraudulent activities or misrepresent yourself or your listings</li>
              <li>Collect or harvest data from other users without their consent</li>
              <li>Use automated methods to access or use the Service without our permission</li>
              <li>Manipulate the price of any item or interfere with other users' listings</li>
            </ul>
            <p>
              Violation of these prohibited activities may result in the removal of content, suspension or termination of your account, and/or legal action.
            </p>
          </div>

          {/* Intellectual Property */}
          <div className="prose max-w-none mb-12" id="intellectual">
            <h2>6. Intellectual Property</h2>
            
            <h3>6.1 Our Intellectual Property</h3>
            <p>
              The Service and its original content, features, and functionality are and will remain the exclusive property of Nijahomzs and its licensors. The Service is protected by copyright, trademark, and other laws of Nigeria and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Nijahomzs.
            </p>
            
            <h3>6.2 Your Content</h3>
            <p>
              By posting content to the Service, you grant Nijahomzs a non-exclusive, worldwide, royalty-free license to use, modify, reproduce, distribute, and display such content in connection with providing and promoting the Service. You represent and warrant that you own or have the necessary rights to post the content and that the content does not violate the rights of any third party.
            </p>
            
            <h3>6.3 Copyright Infringement</h3>
            <p>
              If you believe that any content on the Service infringes upon your copyright, please contact us with information including:
            </p>
            <ul>
              <li>An identification of the copyrighted work claimed to have been infringed</li>
              <li>A description of where the material is located on the Service</li>
              <li>Your contact information</li>
              <li>A statement that you have a good faith belief that use of the material is not authorized</li>
              <li>A statement that the information is accurate and, under penalty of perjury, that you are authorized to act on behalf of the copyright owner</li>
            </ul>
          </div>

          {/* Limitation of Liability */}
          <div className="prose max-w-none mb-12" id="liability">
            <h2>7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Nijahomzs and its directors, employees, partners, agents, suppliers, or affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
            </p>
            <ul>
              <li>Your access to or use of or inability to access or use the Service;</li>
              <li>Any conduct or content of any third party on the Service;</li>
              <li>Any content obtained from the Service; and</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content.</li>
            </ul>
            <p>
              In no event shall our total liability to you for all claims related to the Service exceed the amount paid by you to Nijahomzs during the past six months, or one hundred dollars (₦50,000), whichever is greater.
            </p>
          </div>

          {/* Dispute Resolution */}
          <div className="prose max-w-none mb-12" id="disputes">
            <h2>8. Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law provisions.
            </p>
            <p>
              Any dispute arising from or relating to the subject matter of these Terms shall be finally settled by arbitration in Lagos, Nigeria, using the English language in accordance with the Arbitration and Conciliation Act, Cap A18 Laws of the Federation of Nigeria 2004.
            </p>
            <p>
              Before initiating any legal action, we encourage you to contact us directly to seek a resolution. Most concerns can be resolved quickly and effectively through our customer support channels.
            </p>
          </div>

          {/* Termination */}
          <div className="prose max-w-none mb-12" id="termination">
            <h2>9. Termination</h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
            <p>
              Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or contact us to request account deletion.
            </p>
            <p>
              All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </div>

          {/* Changes to Terms */}
          <div className="prose max-w-none mb-12" id="changes">
            <h2>10. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
            </p>
            <p>
              By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, please stop using the Service.
            </p>
          </div>

          {/* Contact Us */}
          <div className="prose max-w-none" id="contact">
            <h2>11. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us:
            </p>
            <ul>
              <li>By email: <a href="mailto:legal@nijahomzs.com">legal@nijahomzs.com</a></li>
              <li>By phone: +234 901 234 5678</li>
              <li>By mail: 15 Admiralty Way, Lekki Phase 1, Lagos, Nigeria</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Getting Help Section */}
      <div className="py-12 bg-blue-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Have Questions About Our Terms?</h2>
          <p className="text-gray-700 mb-8">
            If you have any questions or need clarification about our Terms of Service, our team is here to help.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <HelpCircle className="text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">FAQ</h3>
              <p className="text-gray-600 mb-4">Find answers to common questions about our platform and policies.</p>
              <Link 
                href="/faq" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                View FAQs
              </Link>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Shield className="text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Privacy Policy</h3>
              <p className="text-gray-600 mb-4">Learn how we protect and handle your personal information.</p>
              <Link 
                href="/privacy" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Read Privacy Policy
              </Link>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Contact Support</h3>
              <p className="text-gray-600 mb-4">Get in touch with our customer support team for assistance.</p>
              <Link 
                href="/contact" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Contact Us
              </Link>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ask a Question
            </Link>
            <Link
              href="/"
              className="px-6 py-3 bg-white text-blue-600 border border-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}