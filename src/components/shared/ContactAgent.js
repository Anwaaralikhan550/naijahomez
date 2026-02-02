'use client';
import React, { useState, useCallback } from 'react';
import { Phone, Mail, MapPin, MessageCircle, Star, Share2, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase-client';
import toast from 'react-hot-toast';

const ContactAgent = ({ 
  agent = {
    id: '',
    name: null,
    title: null,
    rating: null,
    reviewCount: null,
    activeSince: null,
    email: null,
    office: null,
    stats: null,
    businessHours: null
  },
  // Add phoneNumber as a separate prop to handle listing contacts directly
  phoneNumber = null,
  // Add listing info for message context
  listingId = null,
  listingType = null
}) => {
  const { user } = useAuth();
  const [showPhone, setShowPhone] = useState(false);
  const [isRevealingPhone, setIsRevealingPhone] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Format the phone number for display (if available)
  const formattedPhone = phoneNumber ? phoneNumber.replace(/^\+?/, '+') : null;
  
  // Prepare WhatsApp URL - Ensure we remove all non-digits for the WhatsApp URL
  const whatsappUrl = formattedPhone
    ? `https://wa.me/${formattedPhone.replace(/\D/g, '')}?text=Hello, I'm interested in your property listing on Nijahomzs.`
    : null;

  // Handle WhatsApp reveal with loading state and animation
  const handleRevealPhone = useCallback(async () => {
    if (isRevealingPhone || showPhone) return; // Prevent double-click

    setIsRevealingPhone(true);

    // Simulate brief loading for smooth UX
    await new Promise(resolve => setTimeout(resolve, 300));

    setShowPhone(true);
    setIsRevealingPhone(false);

    toast.success('WhatsApp number revealed!', {
      duration: 2000,
      position: 'bottom-center',
      style: {
        background: '#10B981',
        color: 'white',
        fontSize: '14px'
      },
      icon: '📱'
    });
  }, [isRevealingPhone, showPhone]);

  // Handle hide phone
  const handleHidePhone = useCallback(() => {
    setShowPhone(false);
  }, []);

  // Handle share listing
  const handleShare = useCallback(async () => {
    if (isSharing) return; // Prevent double-click

    setIsSharing(true);

    const shareUrl = window.location.href;
    const shareTitle = `Check out this listing on Nijahomzs`;
    const shareText = agent.name
      ? `${shareTitle} - Contact ${agent.name}`
      : shareTitle;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        toast.success('Shared successfully!', {
          duration: 2000,
          icon: '🔗'
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!', {
          duration: 2000,
          position: 'bottom-center',
          style: {
            background: '#3B82F6',
            color: 'white',
            fontSize: '14px'
          },
          icon: '📋'
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast.error('Failed to share', { duration: 2000 });
      }
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, agent.name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!listingId || !listingType) {
      toast.error('Unable to send message - listing information missing');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUser = auth.currentUser || user;
      if (!currentUser) {
        toast.error('Please sign in to send a message');
        // Redirect to login page
        window.location.href = '/login';
        setIsSubmitting(false);
        return;
      }

      // Check if this is a scraped listing (no real userId)
      const isScrapedListing = !agent.id || agent.id === 'unknown' || agent.id === '';
      
      // For scraped listings, route to admin system user
      // For user listings, use the actual recipient
      const recipientId = isScrapedListing ? 'system-admin-scraped' : agent.id;

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          recipientId: recipientId,
          senderId: currentUser.uid,
          listingId,
          listingType,
          senderName: currentUser.displayName || currentUser.email || 'Anonymous',
          senderEmail: currentUser.email,
          isScrapedListing: isScrapedListing,
          originalSellerPhone: formattedPhone || null,
          originalSellerEmail: agent.email || null,
          originalSellerName: agent.name || null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }
      
      // Enhanced success notification
      toast.success('✅ Message sent successfully!', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#10B981',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '16px'
        },
        icon: '📧'
      });

      // Play notification sound
      try {
        const audio = new Audio('/notification-success.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Fallback: system notification sound if audio file not available
          console.log('🔔 Message sent notification');
        });
      } catch (e) {
        console.log('🔔 Audio notification not available');
      }

      // Show additional confirmation alert for important messages
      if (message.length > 100) {
        setTimeout(() => {
          toast('💡 Your detailed message has been forwarded to the seller', {
            duration: 3000,
            position: 'bottom-right',
            style: {
              background: '#3B82F6',
              color: 'white'
            }
          });
        }, 1000);
      }
      
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Enhanced error notification
      toast.error(`❌ ${error.message || 'Failed to send message'}`, {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '16px'
        },
        icon: '⚠️'
      });

      // Play error sound
      try {
        const audio = new Audio('/notification-error.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {
          console.log('🔔 Error notification');
        });
      } catch (e) {
        console.log('🔔 Audio notification not available');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
      <h2 className="text-lg md:text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
        Contact {agent.name ? 'Agent' : 'Seller'}
      </h2>
      
      {/* Agent/Seller Profile */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full overflow-hidden flex-shrink-0">
          <img
            src={agent.photoURL || "/api/placeholder/400/400"}
            alt={agent.name || "User"}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{agent.name || "Contact Seller"}</h3>
          {agent.title && <p className="text-blue-600 text-sm">{agent.title}</p>}
          
          {/* Only show ratings if they exist */}
          {agent.rating && agent.reviewCount && (
            <div className="flex items-center gap-1 text-yellow-500 mt-1">
              <Star size={16} fill="currentColor" />
              <span className="text-gray-600 text-sm">
                {agent.rating} ({agent.reviewCount} reviews)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Contact Information - Only show this section if there's at least one contact method */}
      {(formattedPhone || agent.email) && (
        <div className="space-y-3 mb-6">
          {/* Only show phone section if a phone number exists */}
          {formattedPhone && (
            <>
              {!showPhone ? (
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500 text-white p-2 rounded-full">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">WhatsApp/Phone</p>
                    <p className="text-gray-900">••• ••• •••• (Click button below)</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="bg-green-500 text-white p-2 rounded-full">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">WhatsApp/Phone</p>
                    <p className="text-gray-900">{formattedPhone}</p>
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Only show email if actually provided */}
          {agent.email && (
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 text-white p-2 rounded-full">
                <Mail size={16} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{agent.email}</p>
              </div>
            </div>
          )}
          
          {/* Only show office location if actually provided */}
          {agent.office && (
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 text-white p-2 rounded-full">
                <MapPin size={16} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="text-gray-900">{agent.office}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h4 className="font-medium text-gray-900">Send Message</h4>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="I'm interested in this listing and would like to know more about it..."
          className="w-full p-3 border rounded-lg text-gray-700 bg-gray-50 min-h-[100px] resize-none"
          rows="4"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <MessageCircle size={18} />
              Send Message
            </>
          )}
        </button>

        {/* WhatsApp button only if phone number exists */}
        {formattedPhone && (
          <div className={`transition-all duration-300 ease-in-out ${showPhone ? 'transform scale-100 opacity-100' : ''}`}>
            {showPhone ? (
              <div className="w-full bg-green-100 text-green-800 py-3 px-4 rounded-lg text-center space-y-2 animate-in fade-in duration-300">
                <p className="font-medium">WhatsApp Number</p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-bold block hover:text-green-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {formattedPhone}
                </a>
                <button
                  type="button"
                  onClick={handleHidePhone}
                  className="text-sm text-green-700 hover:text-green-800 transition-colors"
                >
                  Hide Number
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRevealPhone}
                disabled={isRevealingPhone}
                className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isRevealingPhone ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Revealing...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-1">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span>Contact via WhatsApp</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          disabled={isSharing}
          className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSharing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Sharing...
            </>
          ) : (
            <>
              <Share2 size={18} />
              Share Listing
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ContactAgent;