// components/layout/Footer.js
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-blue-50 border-t">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* About Section */}
          <div className="text-center md:text-left">
            <h3 className="font-semibold mb-4 text-blue-900">About Us</h3>
            <div className="flex justify-center md:justify-start">
              <img 
                src="/nijahomzs-logo.png"
                alt="Nijahomzs Logo"
                className="mb-4 w-32 h-auto"
                loading="lazy"
              />
            </div>
            <p className="text-gray-700">
              Nijahomzs is your comprehensive platform for discovering properties, marketplace items, and professional services.
            </p>
          </div>
          
          {/* Quick Links */}
          <div className="text-center md:text-left">
            <h3 className="font-semibold mb-4 text-blue-900">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/property" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Property
                </Link>
              </li>
              <li>
                <Link href="/housemate" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Housemate
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/tradespeople" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Tradespeople
                </Link>
              </li>
              <li>
                <Link href="/post-ad" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Post Ad
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Support */}
          <div className="text-center md:text-left">
            <h3 className="font-semibold mb-4 text-blue-900">Support</h3>
            <ul className="space-y-2">
            <li>
                <Link href="/about" className="text-gray-700 hover:text-orange-500 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Contact Us
                </Link>
              </li>
              
              <li>
                <Link href="/privacy" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-700 hover:text-orange-500 transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Connect Section */}
          <div className="text-center md:text-left">
            <h3 className="font-semibold mb-4 text-blue-900">Connect With Us</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://www.facebook.com/profile.php?id=61556149863518" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-orange-500 transition-colors"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a 
                  href="https://twitter.com/Nijahomzs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-orange-500 transition-colors"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a 
                  href="https://www.linkedin.com/in/nijahomzsofficial/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-orange-500 transition-colors"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a 
                  href="https://www.instagram.com/nijahomzs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-orange-500 transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a 
                  href="mailto:support@nijahomzs.com"
                  className="text-gray-700 hover:text-orange-500 transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} Nijahomzs. All Rights Reserved.</p>
          <p className="text-sm mt-2">Connecting you with opportunities</p>
        </div>
      </div>
    </footer>
  );
}