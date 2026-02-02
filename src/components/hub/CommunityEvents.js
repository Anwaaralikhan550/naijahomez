'use client';
import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  Plus,
  Search,
  MapPin,
  Clock,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Heart,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const CommunityEvents = ({ communityId: propCommunityId }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(true); // Track community loading state
  const [selectedView, setSelectedView] = useState('calendar'); // calendar, grid, list
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [currentCommunity, setCurrentCommunity] = useState(propCommunityId || null);

  // Get current community from localStorage or user memberships
  useEffect(() => {
    const loadCommunity = async () => {
      setCommunityLoading(true);

      if (propCommunityId) {
        setCurrentCommunity(propCommunityId);
        setCommunityLoading(false);
        return;
      }

      if (user) {
        try {
          // Check localStorage first
          const stored = localStorage.getItem('hubCurrentCommunity');
          if (stored) {
            setCurrentCommunity(stored);
            setCommunityLoading(false);
            return;
          }

          // Get user's communities to find primary community
          const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          const result = await response.json();

          if (response.ok && result.communities?.length > 0) {
            const primaryCommunity = result.communities.find(c => c.role === 'admin') || result.communities[0];
            setCurrentCommunity(primaryCommunity.id);
          }
          // If no communities found, currentCommunity stays null
        } catch (error) {
          console.error('Error loading community:', error);
        }
      }
      // Mark loading complete regardless of outcome
      setCommunityLoading(false);
    };

    loadCommunity();
  }, [user, propCommunityId]);

  useEffect(() => {
    if (currentCommunity) {
      loadEvents();
    }
  }, [currentCommunity]);

  useEffect(() => {
    filterEvents();
  }, [events, searchTerm]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/social-feed?communityId=${currentCommunity}&filter=events`);
      const result = await response.json();

      if (response.ok) {
        // Only get event posts from social feed
        const eventPosts = (result.posts || []).filter(post => post.type === 'event');
        setEvents(eventPosts);
      } else {
        console.error('Failed to load events:', result);
        toast.error('Failed to load events');
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    if (searchTerm) {
      filtered = filtered.filter(event => 
        event.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  };

  const navigateToFeed = () => {
    window.location.href = '/the-hub/feed';
  };

  const rsvpToEvent = async (postId, status) => {
    try {
      const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'rsvp_event',
          postId,
          status,
          userId: user.uid,
          userName: user.displayName || user.email
        })
      });

      if (response.ok) {
        loadEvents(); // Refresh to update attendee counts
        toast.success('RSVP updated!');
      }
    } catch (error) {
      toast.error('Failed to update RSVP');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr;
  };

  const isUpcoming = (eventDate) => {
    if (!eventDate) return false;
    return new Date(eventDate) > new Date();
  };

  const getUserRsvpStatus = (event) => {
    if (!event.rsvps || !user?.uid) return null;
    const userRsvp = event.rsvps.find(rsvp => rsvp.userId === user.uid);
    return userRsvp ? userRsvp.status : null;
  };

  const getAttendeeCount = (event, status) => {
    if (!event.rsvps) return 0;
    return event.rsvps.filter(rsvp => rsvp.status === status).length;
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredEvents.filter(event => {
      const eventDate = event.eventDate;
      return eventDate && eventDate.split('T')[0] === dateStr;
    });
  };

  const formatCalendarDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const EventCard = ({ event }) => {
    const userRsvpStatus = getUserRsvpStatus(event);
    const goingCount = getAttendeeCount(event, 'going');
    const maybeCount = getAttendeeCount(event, 'maybe');
    
    return (
      <div className="bg-white rounded-lg shadow hover:shadow-md transition p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                Event
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-3 line-clamp-3">{event.content}</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            {formatDate(event.eventDate)}
            {event.eventTime && ` at ${formatTime(event.eventTime)}`}
          </div>
          
          {event.location && (
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              {event.location}
            </div>
          )}
          
          <div className="flex items-center text-sm text-gray-600">
            <Users className="w-4 h-4 mr-2" />
            {goingCount} going, {maybeCount} maybe
            {event.maxAttendees && ` (max ${event.maxAttendees})`}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            By {event.authorName}
          </div>
          
          <div className="flex gap-2">
            {isUpcoming(event.eventDate) && (
              <div className="flex gap-1">
                <button
                  onClick={() => rsvpToEvent(event.id, 'going')}
                  className={`px-3 py-1 text-xs rounded transition ${
                    userRsvpStatus === 'going' 
                      ? 'bg-green-600 text-white' 
                      : 'border border-green-600 text-green-600 hover:bg-green-50'
                  }`}
                >
                  Going
                </button>
                <button
                  onClick={() => rsvpToEvent(event.id, 'maybe')}
                  className={`px-3 py-1 text-xs rounded transition ${
                    userRsvpStatus === 'maybe' 
                      ? 'bg-yellow-600 text-white' 
                      : 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50'
                  }`}
                >
                  Maybe
                </button>
              </div>
            )}
            
            <button
              onClick={() => {
                setSelectedEvent(event);
                setShowEventDetails(true);
              }}
              className="bg-blue-600 text-white px-3 py-1 text-xs rounded hover:bg-blue-700 transition"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CalendarView = () => {
    const days = getCalendarDays();
    const today = new Date();
    const currentMonth = currentDate.getMonth();

    return (
      <div className="bg-white rounded-lg shadow">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <h3 className="text-lg font-semibold">
            {formatCalendarDate(currentDate)}
          </h3>
          
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const isCurrentMonth = day.getMonth() === currentMonth;
              const isToday = day.toDateString() === today.toDateString();
              const dayEvents = getEventsForDate(day);
              
              return (
                <div
                  key={index}
                  className={`min-h-[80px] p-1 border rounded hover:bg-gray-50 ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  } ${
                    isToday ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                  } ${
                    isToday ? 'text-blue-600' : ''
                  }`}>
                    {day.getDate()}
                  </div>
                  
                  {/* Events for this day */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event, eventIndex) => (
                      <div
                        key={eventIndex}
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventDetails(true);
                        }}
                        className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded cursor-pointer hover:bg-blue-200 truncate"
                        title={event.content}
                      >
                        {event.content.length > 15 ? event.content.substring(0, 15) + '...' : event.content}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Show loading state while community is being loaded
  if (communityLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Loading community...</p>
          <p className="text-sm text-gray-400 mt-1">Please wait while we load your community information</p>
        </div>
      </div>
    );
  }

  // Show "no community" state if loading is complete but no community found
  if (!currentCommunity) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">You're not part of any communities</p>
          <p className="text-sm text-gray-400 mt-1">Join a community to view and participate in events</p>
          <button
            onClick={() => window.location.href = '/the-hub/communities'}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Browse Communities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Community Events</h3>
          <p className="text-gray-600">View events from the community feed</p>
        </div>
        <button
          onClick={navigateToFeed}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Event Post
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search events..."
            />
          </div>

          {/* View Toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setSelectedView('calendar')}
              className={`px-3 py-2 text-sm flex items-center ${selectedView === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Calendar
            </button>
            <button
              onClick={() => setSelectedView('grid')}
              className={`px-3 py-2 text-sm flex items-center ${selectedView === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <Grid className="w-4 h-4 mr-1" />
              Grid
            </button>
            <button
              onClick={() => setSelectedView('list')}
              className={`px-3 py-2 text-sm flex items-center ${selectedView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Events Display */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No events found</p>
          <p className="text-sm text-gray-400 mt-1">Create event posts in the community feed!</p>
          <button
            onClick={navigateToFeed}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Feed
          </button>
        </div>
      ) : (
        <>
          {selectedView === 'calendar' && <CalendarView />}
          {selectedView !== 'calendar' && (
            <div className={selectedView === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 mb-2">
                    Event
                  </span>
                  <p className="text-gray-700 text-lg">{selectedEvent.content}</p>
                </div>
                <button
                  onClick={() => setShowEventDetails(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                      <span>{formatDate(selectedEvent.eventDate)}</span>
                    </div>
                    
                    {selectedEvent.eventTime && (
                      <div className="flex items-center text-sm">
                        <Clock className="w-4 h-4 mr-2 text-gray-600" />
                        <span>{formatTime(selectedEvent.eventTime)}</span>
                      </div>
                    )}
                    
                    {selectedEvent.location && (
                      <div className="flex items-center text-sm">
                        <MapPin className="w-4 h-4 mr-2 text-gray-600" />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 mr-2 text-gray-600" />
                      <span>{getAttendeeCount(selectedEvent, 'going')} going, {getAttendeeCount(selectedEvent, 'maybe')} maybe</span>
                    </div>
                    
                    <div className="flex items-center text-sm">
                      <User className="w-4 h-4 mr-2 text-gray-600" />
                      <span>Created by {selectedEvent.authorName}</span>
                    </div>
                  </div>
                </div>

                {/* Show attendee list */}
                {selectedEvent.rsvps && selectedEvent.rsvps.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Attendees</h4>
                    <div className="space-y-2">
                      {['going', 'maybe'].map(status => {
                        const attendees = selectedEvent.rsvps.filter(rsvp => rsvp.status === status);
                        if (attendees.length === 0) return null;
                        
                        return (
                          <div key={status}>
                            <h5 className={`text-sm font-medium ${
                              status === 'going' ? 'text-green-700' : 'text-yellow-700'
                            }`}>
                              {status === 'going' ? 'Going' : 'Maybe'} ({attendees.length})
                            </h5>
                            <div className="flex flex-wrap gap-1">
                              {attendees.map((rsvp, index) => (
                                <span
                                  key={index}
                                  className={`px-2 py-1 text-xs rounded ${
                                    status === 'going' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {rsvp.userName}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isUpcoming(selectedEvent.eventDate) && (
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => rsvpToEvent(selectedEvent.id, 'going')}
                      className={`flex-1 px-4 py-2 rounded-lg transition ${
                        getUserRsvpStatus(selectedEvent) === 'going' 
                          ? 'bg-green-600 text-white' 
                          : 'border border-green-600 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {getUserRsvpStatus(selectedEvent) === 'going' ? 'Going ✓' : 'Going'}
                    </button>
                    <button
                      onClick={() => rsvpToEvent(selectedEvent.id, 'maybe')}
                      className={`flex-1 px-4 py-2 rounded-lg transition ${
                        getUserRsvpStatus(selectedEvent) === 'maybe' 
                          ? 'bg-yellow-600 text-white' 
                          : 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50'
                      }`}
                    >
                      {getUserRsvpStatus(selectedEvent) === 'maybe' ? 'Maybe ✓' : 'Maybe'}
                    </button>
                    <button
                      onClick={() => rsvpToEvent(selectedEvent.id, 'not_going')}
                      className={`flex-1 px-4 py-2 rounded-lg transition ${
                        getUserRsvpStatus(selectedEvent) === 'not_going' 
                          ? 'bg-red-600 text-white' 
                          : 'border border-red-600 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      {getUserRsvpStatus(selectedEvent) === 'not_going' ? 'Not Going ✓' : 'Can\'t Go'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityEvents;