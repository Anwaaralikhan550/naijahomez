'use client';
import React, { useState, useEffect, useCallback } from 'react';
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
  X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const MAX_EVENT_CONTENT_LENGTH = 3000;
const MAX_EVENT_LOCATION_LENGTH = 180;

const safeDisplayText = (value, fallback = '') => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return fallback;
};

const CommunityEvents = ({ communityId: propCommunityId }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('calendar');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [rsvpPendingByEvent, setRsvpPendingByEvent] = useState({});
  const [eventForm, setEventForm] = useState({
    content: '',
    eventDate: '',
    eventTime: '',
    location: '',
    maxAttendees: ''
  });
  const [eventFormErrors, setEventFormErrors] = useState({});
  const [currentCommunity, setCurrentCommunity] = useState(propCommunityId || null);

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
          const stored = localStorage.getItem('hubCurrentCommunity');
          if (stored) {
            setCurrentCommunity(stored);
            setCommunityLoading(false);
            return;
          }

          const response = await authenticatedFetch(`/api/hub/communities?type=user&userId=${user.uid}`);
          const result = await response.json();

          if (response.ok && result.communities?.length > 0) {
            const primaryCommunity = result.communities.find((c) => c.role === 'admin') || result.communities[0];
            setCurrentCommunity(primaryCommunity.id);
          }
        } catch (error) {
          console.error('Error loading community:', error);
        }
      }

      setCommunityLoading(false);
    };

    loadCommunity();
  }, [user, propCommunityId]);

  const loadEvents = useCallback(async () => {
    if (!currentCommunity) return;

    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/hub/social-feed?communityId=${currentCommunity}&filter=events`);
      const result = await response.json();

      if (response.ok) {
        const eventPosts = (result.posts || []).filter((post) => post.type === 'event');
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
  }, [currentCommunity]);

  const filterEvents = useCallback(() => {
    let filtered = [...events];

    if (searchTerm) {
      filtered = filtered.filter(
        (event) =>
          safeDisplayText(event.content).toLowerCase().includes(searchTerm.toLowerCase()) ||
          safeDisplayText(event.location).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  }, [events, searchTerm]);

  useEffect(() => {
    if (currentCommunity) {
      loadEvents();
    }
  }, [currentCommunity, loadEvents]);

  useEffect(() => {
    filterEvents();
  }, [filterEvents]);

  const updateEventFormField = (field, value) => {
    setEventForm((prev) => ({ ...prev, [field]: value }));
    setEventFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const resetEventForm = () => {
    setEventForm({
      content: '',
      eventDate: '',
      eventTime: '',
      location: '',
      maxAttendees: ''
    });
    setEventFormErrors({});
  };

  const validateEventForm = () => {
    const errors = {};
    const trimmedContent = eventForm.content.trim();
    const trimmedLocation = eventForm.location.trim();

    if (!trimmedContent) {
      errors.content = 'Event description is required';
    } else if (trimmedContent.length > MAX_EVENT_CONTENT_LENGTH) {
      errors.content = `Description must be ${MAX_EVENT_CONTENT_LENGTH} characters or less`;
    }

    if (!eventForm.eventDate) errors.eventDate = 'Date is required';
    if (!eventForm.eventTime) errors.eventTime = 'Time is required';

    if (!trimmedLocation) {
      errors.location = 'Venue is required';
    } else if (trimmedLocation.length > MAX_EVENT_LOCATION_LENGTH) {
      errors.location = `Venue must be ${MAX_EVENT_LOCATION_LENGTH} characters or less`;
    }

    if (eventForm.maxAttendees && Number(eventForm.maxAttendees) < 1) {
      errors.maxAttendees = 'Max attendees must be at least 1';
    }

    setEventFormErrors(errors);
    return { isValid: Object.keys(errors).length === 0, trimmedContent, trimmedLocation };
  };

  const createEventPost = async (e) => {
    e.preventDefault();
    const { isValid, trimmedContent, trimmedLocation } = validateEventForm();

    if (!isValid) {
      toast.error('Please complete required fields: Date, Time, Venue');
      return;
    }

    try {
      setIsCreatingEvent(true);
      const payload = {
        action: 'create_post',
        communityId: currentCommunity,
        type: 'event',
        content: trimmedContent,
        location: trimmedLocation,
        eventDate: eventForm.eventDate,
        eventTime: eventForm.eventTime,
        maxAttendees: eventForm.maxAttendees ? String(eventForm.maxAttendees) : '',
        authorId: user.uid,
        authorName: user.displayName || user.email,
        tags: [],
        attachments: []
      };

      const response = await authenticatedFetch(`/api/hub/social-feed?userId=${user.uid}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = typeof result?.error === 'string' ? result.error : 'Failed to create event';
        throw new Error(message);
      }

      toast.success('Event created successfully');
      setShowCreateEventModal(false);
      resetEventForm();
      await loadEvents();
    } catch (error) {
      toast.error(error?.message || 'Failed to create event');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const applyRsvpUpdateLocally = (postId, status) => {
    const nextRsvpList = (existing) => {
      const list = Array.isArray(existing) ? [...existing] : [];
      const filtered = list.filter((rsvp) => rsvp.userId !== user.uid);

      if (status !== 'not_going') {
        filtered.push({
          userId: user.uid,
          userName: user.displayName || user.email,
          status,
          timestamp: new Date().toISOString()
        });
      }

      return filtered;
    };

    setEvents((prevEvents) =>
      prevEvents.map((event) => {
        if (event.id !== postId) return event;
        return { ...event, rsvps: nextRsvpList(event.rsvps) };
      })
    );

    setSelectedEvent((prevSelected) => {
      if (!prevSelected || prevSelected.id !== postId) return prevSelected;
      return { ...prevSelected, rsvps: nextRsvpList(prevSelected.rsvps) };
    });
  };

  const rsvpToEvent = async (postId, status) => {
    if (!user?.uid) return;

    const prevEvents = events;
    const prevSelectedEvent = selectedEvent;
    applyRsvpUpdateLocally(postId, status);
    setRsvpPendingByEvent((prev) => ({ ...prev, [postId]: true }));

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

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof result?.error === 'string' ? result.error : 'Failed to update RSVP';
        throw new Error(message);
      }

      toast.success(status === 'not_going' ? 'Attendance cancelled' : 'RSVP updated');
    } catch (error) {
      setEvents(prevEvents);
      setSelectedEvent(prevSelectedEvent);
      toast.error(error?.message || 'Failed to update RSVP');
    } finally {
      setRsvpPendingByEvent((prev) => ({ ...prev, [postId]: false }));
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
    const userRsvp = event.rsvps.find((rsvp) => rsvp.userId === user.uid);
    return userRsvp ? userRsvp.status : null;
  };

  const getAttendeeCount = (event, status) => {
    if (!event.rsvps) return 0;
    return event.rsvps.filter((rsvp) => rsvp.status === status).length;
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
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
    return filteredEvents.filter((event) => {
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
    const isRsvpPending = !!rsvpPendingByEvent[event.id];

    return (
      <div className="bg-white rounded-lg shadow hover:shadow-md transition p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                Event
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-3 line-clamp-3">{safeDisplayText(event.content, 'No description')}</p>
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
              {safeDisplayText(event.location)}
            </div>
          )}

          <div className="flex items-center text-sm text-gray-600">
            <Users className="w-4 h-4 mr-2" />
            {goingCount} going, {maybeCount} maybe
            {event.maxAttendees && ` (max ${event.maxAttendees})`}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">By {safeDisplayText(event.authorName, 'Unknown user')}</div>

          <div className="flex gap-2">
            {isUpcoming(event.eventDate) && (
              <div className="flex gap-1 flex-wrap justify-end">
                <button
                  disabled={isRsvpPending}
                  onClick={() => rsvpToEvent(event.id, 'going')}
                  className={`px-3 py-1 text-xs rounded transition ${
                    userRsvpStatus === 'going'
                      ? 'bg-green-600 text-white'
                      : 'border border-green-600 text-green-600 hover:bg-green-50'
                  } ${isRsvpPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {userRsvpStatus === 'going' ? 'Attending' : 'Attend'}
                </button>
                <button
                  disabled={isRsvpPending}
                  onClick={() => rsvpToEvent(event.id, 'maybe')}
                  className={`px-3 py-1 text-xs rounded transition ${
                    userRsvpStatus === 'maybe'
                      ? 'bg-yellow-600 text-white'
                      : 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50'
                  } ${isRsvpPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  Maybe
                </button>
                {(userRsvpStatus === 'going' || userRsvpStatus === 'maybe') && (
                  <button
                    disabled={isRsvpPending}
                    onClick={() => rsvpToEvent(event.id, 'not_going')}
                    className={`px-3 py-1 text-xs rounded border border-red-600 text-red-600 hover:bg-red-50 transition ${
                      isRsvpPending ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    Cancel Attendance
                  </button>
                )}
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
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h3 className="text-lg font-semibold">{formatCalendarDate(currentDate)}</h3>

          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

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
                  } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${isToday ? 'text-blue-600' : ''}`}
                  >
                    {day.getDate()}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event, eventIndex) => {
                      const title = safeDisplayText(event.content);
                      return (
                        <div
                          key={eventIndex}
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowEventDetails(true);
                          }}
                          className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded cursor-pointer hover:bg-blue-200 truncate"
                          title={title}
                        >
                          {title.length > 15 ? `${title.substring(0, 15)}...` : title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && <div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

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

  if (!currentCommunity) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">You're not part of any communities</p>
          <p className="text-sm text-gray-400 mt-1">Join a community to view and participate in events</p>
          <button
            onClick={() => {
              window.location.href = '/dashboard/community/communities';
            }}
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
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Community Events</h3>
          <p className="text-gray-600">View and create events without leaving this screen</p>
        </div>
        <button
          onClick={() => {
            resetEventForm();
            setShowCreateEventModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Event
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
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

          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setSelectedView('calendar')}
              className={`px-3 py-2 text-sm flex items-center ${
                selectedView === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Calendar
            </button>
            <button
              onClick={() => setSelectedView('grid')}
              className={`px-3 py-2 text-sm flex items-center ${
                selectedView === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Grid className="w-4 h-4 mr-1" />
              Grid
            </button>
            <button
              onClick={() => setSelectedView('list')}
              className={`px-3 py-2 text-sm flex items-center ${
                selectedView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No events found</p>
          <p className="text-sm text-gray-400 mt-1">Create your first community event from here.</p>
          <button
            onClick={() => {
              resetEventForm();
              setShowCreateEventModal(true);
            }}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Create Event
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

      {showEventDetails && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 mb-2">
                    Event
                  </span>
                  <p className="text-gray-700 text-lg">{safeDisplayText(selectedEvent.content, 'No description')}</p>
                </div>
                <button
                  onClick={() => setShowEventDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close event details"
                >
                  <X className="w-6 h-6" />
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
                        <span>{safeDisplayText(selectedEvent.location)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 mr-2 text-gray-600" />
                      <span>
                        {getAttendeeCount(selectedEvent, 'going')} going, {getAttendeeCount(selectedEvent, 'maybe')} maybe
                      </span>
                    </div>

                    <div className="flex items-center text-sm">
                      <User className="w-4 h-4 mr-2 text-gray-600" />
                      <span>Created by {safeDisplayText(selectedEvent.authorName, 'Unknown user')}</span>
                    </div>
                  </div>
                </div>

                {selectedEvent.rsvps && selectedEvent.rsvps.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Attendees</h4>
                    <div className="space-y-2">
                      {['going', 'maybe'].map((status) => {
                        const attendees = selectedEvent.rsvps.filter((rsvp) => rsvp.status === status);
                        if (attendees.length === 0) return null;

                        return (
                          <div key={status}>
                            <h5 className={`text-sm font-medium ${status === 'going' ? 'text-green-700' : 'text-yellow-700'}`}>
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
                                  {safeDisplayText(rsvp.userName, 'Member')}
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
                      disabled={!!rsvpPendingByEvent[selectedEvent.id]}
                      onClick={() => rsvpToEvent(selectedEvent.id, 'going')}
                      className={`flex-1 px-4 py-2 rounded-lg transition ${
                        getUserRsvpStatus(selectedEvent) === 'going'
                          ? 'bg-green-600 text-white'
                          : 'border border-green-600 text-green-600 hover:bg-green-50'
                      } ${rsvpPendingByEvent[selectedEvent.id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {getUserRsvpStatus(selectedEvent) === 'going' ? 'Attending' : 'Attend'}
                    </button>
                    <button
                      disabled={!!rsvpPendingByEvent[selectedEvent.id]}
                      onClick={() => rsvpToEvent(selectedEvent.id, 'maybe')}
                      className={`flex-1 px-4 py-2 rounded-lg transition ${
                        getUserRsvpStatus(selectedEvent) === 'maybe'
                          ? 'bg-yellow-600 text-white'
                          : 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50'
                      } ${rsvpPendingByEvent[selectedEvent.id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {getUserRsvpStatus(selectedEvent) === 'maybe' ? 'Maybe (Selected)' : 'Maybe'}
                    </button>
                    <button
                      disabled={!!rsvpPendingByEvent[selectedEvent.id]}
                      onClick={() => rsvpToEvent(selectedEvent.id, 'not_going')}
                      className={`flex-1 px-4 py-2 rounded-lg transition ${
                        getUserRsvpStatus(selectedEvent) === 'not_going'
                          ? 'bg-red-600 text-white'
                          : 'border border-red-600 text-red-600 hover:bg-red-50'
                      } ${rsvpPendingByEvent[selectedEvent.id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {getUserRsvpStatus(selectedEvent) === 'not_going' ? 'Cancelled' : 'Cancel Attendance'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={createEventPost} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Create Event</h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateEventModal(false);
                    resetEventForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close create event modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={eventForm.content}
                    onChange={(e) => updateEventFormField('content', e.target.value)}
                    rows={4}
                    maxLength={MAX_EVENT_CONTENT_LENGTH}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      eventFormErrors.content ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Describe your event..."
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className={`text-xs ${eventFormErrors.content ? 'text-red-600' : 'text-gray-500'}`}>
                      {eventFormErrors.content || 'Event details and context for members.'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {eventForm.content.length}/{MAX_EVENT_CONTENT_LENGTH}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={eventForm.eventDate}
                      onChange={(e) => updateEventFormField('eventDate', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        eventFormErrors.eventDate ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    />
                    {eventFormErrors.eventDate && <p className="mt-1 text-xs text-red-600">{eventFormErrors.eventDate}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                    <input
                      type="time"
                      value={eventForm.eventTime}
                      onChange={(e) => updateEventFormField('eventTime', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        eventFormErrors.eventTime ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    />
                    {eventFormErrors.eventTime && <p className="mt-1 text-xs text-red-600">{eventFormErrors.eventTime}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => updateEventFormField('location', e.target.value)}
                    maxLength={MAX_EVENT_LOCATION_LENGTH}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      eventFormErrors.location ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Where will the event happen?"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className={`text-xs ${eventFormErrors.location ? 'text-red-600' : 'text-gray-500'}`}>
                      {eventFormErrors.location || 'Venue is mandatory.'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {eventForm.location.length}/{MAX_EVENT_LOCATION_LENGTH}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Attendees (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={eventForm.maxAttendees}
                    onChange={(e) => updateEventFormField('maxAttendees', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      eventFormErrors.maxAttendees ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="e.g. 50"
                  />
                  {eventFormErrors.maxAttendees && <p className="mt-1 text-xs text-red-600">{eventFormErrors.maxAttendees}</p>}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateEventModal(false);
                    resetEventForm();
                  }}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className={`px-4 py-2 rounded-lg text-white transition ${
                    isCreatingEvent ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isCreatingEvent ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityEvents;
