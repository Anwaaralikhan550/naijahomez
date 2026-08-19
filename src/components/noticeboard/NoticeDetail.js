import React, { useState, useEffect } from 'react';
import apiService from '@/services/api';
import { ImageGallery, shouldForceSourceWatermark } from '@/components/property/ImageGallery';
import { MapPin, Tag, Clock, AlertTriangle, Heart, Share2, Calendar, User, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import ContactAgent from '@/components/shared/ContactAgent';
import DOMPurify from 'isomorphic-dompurify';
import ListingReportModal from '@/components/reporting/ListingReportModal';

// Notice types for display
const NOTICE_TYPES = {
  'announcement': 'Announcement',
  'event': 'Event',
  'job': 'Job Opportunity',
  'lost_found': 'Lost & Found',
  'community': 'Community Notice',
  'other': 'Other'
};

export default function NoticeDetail({ params }) {
  // Use React.use() to unwrap params
  const resolvedParams = React.use(params);
  
  const [notice, setNotice] = useState(null);
  const [relatedNotices, setRelatedNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    const loadNoticeData = async () => {
      try {
        // Get notice by slug using API service
        const response = await apiService.getNoticeboardBySlug(resolvedParams.slug);
        
        if (!response || !response.data) {
          setError('Notice not found');
          return;
        }

        const noticeData = response.data;
        setNotice(noticeData);

        // Use similar notices from API response
        setRelatedNotices(response.similar || []);
      } catch (error) {
        console.error('Error loading notice:', error);
        setError('Failed to load notice data');
      } finally {
        setLoading(false);
      }
    };

    loadNoticeData();
  }, [resolvedParams.slug]);


  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: notice.title,
          text: `Check out this notice: ${notice.title}`,
          url: window.location.href
        });
        toast.success('Shared successfully!');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share');
    }
  };

  const handleSaveNotice = () => {
    setIsSaved(!isSaved);
    toast.success(isSaved ? 'Removed from saved notices' : 'Added to saved notices');
    // In a real implementation, this would save to user's favorites in database
  };

  // Calculate listing date
  const getListingAge = () => {
    if (!notice?.createdAt) return null;
    
    const createdDate = notice.createdAt.seconds 
      ? new Date(notice.createdAt.seconds * 1000) 
      : new Date(notice.createdAt);
    
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Posted today";
    if (diffDays === 1) return "Posted yesterday";
    if (diffDays < 7) return `Posted ${diffDays} days ago`;
    if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
    
    return `Posted ${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
  };

  // Format event date if available
  const formatEventDate = () => {
    if (!notice?.eventDate) return null;
    
    const eventDate = notice.eventDate.seconds 
      ? new Date(notice.eventDate.seconds * 1000) 
      : new Date(notice.eventDate);
    
    return eventDate.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-blue-500 rounded-full mb-4 mx-auto"></div>
            <p className="text-gray-600">Loading notice details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl shadow-lg">
          <div className="bg-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <p className="text-red-600 text-2xl mb-4">
            {error || 'Notice could not be found'}
          </p>
          <p className="text-red-500 mb-4">
            Please check the notice link or try again later.
          </p>
          <Link 
            href="/noticeboard" 
            className="text-blue-500 hover:text-blue-600"
          >
            Return to Noticeboard
          </Link>
        </div>
      </div>
    );
  }

  const normalizedPosterKycStatus = (
    notice?.user?.kycStatus ||
    notice?.kycStatus ||
    ''
  ).toString().toLowerCase();
  const isPosterVerified = Boolean(
    notice?.agentVerified ||
    notice?.userVerified ||
    notice?.isVerified ||
    notice?.verified ||
    normalizedPosterKycStatus === 'verified'
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
          <Link href="/noticeboard" className="hover:text-blue-500">
            Noticeboard
          </Link>
          <span>/</span>
          <Link 
            href={`/noticeboard?noticeType=${notice.noticeType}`} 
            className="hover:text-blue-500"
          >
            {NOTICE_TYPES[notice.noticeType] || 'Notices'}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{notice.title}</span>
        </div>

        {/* Notice Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-xl md:text-2xl font-bold text-blue-900">
                    {notice.title}
                  </h1>
                  {isPosterVerified && (
                    <span
                      title="Identity verified"
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      <CheckCircle size={12} />
                      Verified
                    </span>
                  )}
                  {notice.noticeType && (
                    <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-sm">
                      {NOTICE_TYPES[notice.noticeType] || notice.noticeType}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-gray-700 mb-2">
                  <MapPin size={20} className="mr-2 text-blue-500" />
                  <span className="text-base md:text-lg">{notice.location}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {notice.createdAt && (
                    <div className="flex items-center">
                      <Clock size={16} className="mr-1" />
                      <span>{getListingAge()}</span>
                    </div>
                  )}
                  {notice.viewCount > 0 && (
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <span>{notice.viewCount} views</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-left md:text-right">
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                  <button 
                    onClick={handleSaveNotice}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm
                      ${isSaved 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    <Heart size={16} fill={isSaved ? "currentColor" : "none"} />
                    <span>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                  <button 
                    onClick={handleShare}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Image Gallery */}
            {notice.imageUrls && notice.imageUrls.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <ImageGallery
                  images={notice.imageUrls}
                  coverSourceWatermark={shouldForceSourceWatermark(notice)}
                />
              </div>
            )}

            {/* Notice Description */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
                Details
              </h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">{notice.description}</p>
              </div>
            </div>

            {/* Event Details - Only shown for event notices */}
            {notice.noticeType === 'event' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
                  Event Information
                </h2>
                <div className="space-y-4">
                  {notice.eventDate && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800">Date & Time</h3>
                        <p className="text-gray-600">{formatEventDate()}</p>
                        {notice.eventTime && (
                          <p className="text-gray-600">{notice.eventTime}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {notice.venue && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <MapPin className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800">Venue</h3>
                        <p className="text-gray-600">{notice.venue}</p>
                      </div>
                    </div>
                  )}
                  
                  {notice.organizer && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800">Organizer</h3>
                        <p className="text-gray-600">{notice.organizer}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Job Details - Only shown for job notices */}
            {notice.noticeType === 'job' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-blue-900 mb-6 border-b pb-4">
                  Job Details
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {notice.jobType && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="text-gray-600">{notice.jobType}</span>
                    </div>
                  )}
                  
                  {notice.salary && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-gray-700">Salary:</span>
                      <span className="text-gray-600">{notice.salary}</span>
                    </div>
                  )}
                  
                  {notice.company && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-gray-700">Company:</span>
                      <span className="text-gray-600">{notice.company}</span>
                    </div>
                  )}
                  
                  {notice.deadline && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-gray-700">Deadline:</span>
                      <span className="text-gray-600">
                        {notice.deadline?.seconds
                          ? new Date(notice.deadline.seconds * 1000).toLocaleDateString()
                          : notice.deadline
                            ? new Date(notice.deadline).toLocaleDateString()
                            : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Report Button */}
            <div className="flex justify-end w-full">
              <button 
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <AlertTriangle size={16} />
                <span>Report this Ad</span>
              </button>
            </div>
          </div>

          {/* Contact Section */}
          <div className="md:col-span-1 space-y-8">
            <ContactAgent 
              agent={{
                id: notice.userId,
                name: notice.userName,
                title: "Notice Publisher",
                email: notice.userEmail,
                photoURL: notice.userPhotoURL,
                kycStatus: notice?.user?.kycStatus || notice?.kycStatus || null,
                type: 'poster' // This indicates it's a notice poster
              }}
              // Pass the phone number and creation date directly
              phoneNumber={notice.phoneNumber}
              createdAt={notice.createdAt}
              // Pass view count if available
              viewCount={notice.viewCount}
              // Pass listing information for message context
              listingId={notice.id}
              listingType="noticeboard"
            />

            {/* Similar Notices */}
            {relatedNotices.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-4 border-b pb-4">
                  Related Notices
                </h2>
                <div className="space-y-4">
                  {relatedNotices.map((relatedNotice) => (
                    <Link 
                      key={relatedNotice.id} 
                      href={`/noticeboard/${relatedNotice.slug}`}
                      className="block group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative w-20 h-16 md:w-24 md:h-20 rounded-lg shrink-0 overflow-hidden">
                          <Image
                            src={relatedNotice.imageUrls?.[0] || "/api/placeholder/400/300"}
                            alt={relatedNotice.title}
                            fill
                            sizes="(max-width: 768px) 80px, 96px"
                            className="object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-blue-900 group-hover:text-blue-700 truncate">
                            {relatedNotice.title}
                          </h3>
                          <div className="flex items-center gap-1 text-sm mt-1">
                            <Tag size={14} className="text-gray-500" />
                            <span className="text-gray-500">
                              {NOTICE_TYPES[relatedNotice.noticeType] || relatedNotice.noticeType}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-600 text-sm mt-1">
                            <Clock size={14} className="mr-1" />
                            <span>
                              {relatedNotice.createdAt?.seconds
                                ? new Date(relatedNotice.createdAt.seconds * 1000).toLocaleDateString()
                                : relatedNotice.createdAt?.toDate
                                  ? relatedNotice.createdAt.toDate().toLocaleDateString()
                                  : relatedNotice.createdAt
                                    ? new Date(relatedNotice.createdAt).toLocaleDateString()
                                    : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Safety Tips */}
            <div className="bg-yellow-50 rounded-xl p-6">
              <h3 className="font-semibold text-yellow-800 mb-3">Safety Tips</h3>
              <ul className="text-sm text-yellow-700 space-y-2">
                <li>• Verify notice details before taking action</li>
                <li>• Meet in public places for in-person interactions</li>
                <li>• Never send money to unknown individuals</li>
                <li>• Report suspicious notices to our team</li>
                <li>• Exercise caution with personal information</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <ListingReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        listing={{
          listingId: notice.id || notice.slug,
          listingTitle: notice.title,
          listingType: 'noticeboard',
          collectionName: 'noticeboard',
          listingSlug: notice.slug,
          listingPath: notice.slug ? `/noticeboard/${notice.slug}` : '',
          listingUrl: notice.slug ? `/noticeboard/${notice.slug}` : ''
        }}
      />
    </div>
  );
}
