'use client';
import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Shield, 
  Heart, 
  Flame, 
  Zap,
  Wrench,
  Plus, 
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle,
  MapPin,
  Clock,
  Star,
  PhoneCall
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const EmergencyContacts = ({ communityId }) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contactType: 'police',
    phoneNumber: '',
    alternatePhone: '',
    email: '',
    address: '',
    availability: '24/7',
    isVerified: false,
    isEmergencyOnly: true
  });

  // Emergency categories with icons and colors
  const categories = [
    { id: 'all', label: 'All Contacts', icon: Phone, color: 'text-gray-600' },
    { id: 'police', label: 'Police', icon: Shield, color: 'text-blue-600' },
    { id: 'fire', label: 'Fire Service', icon: Flame, color: 'text-red-600' },
    { id: 'medical', label: 'Medical', icon: Heart, color: 'text-green-600' },
    { id: 'security', label: 'Security', icon: Shield, color: 'text-purple-600' },
    { id: 'utility', label: 'Utilities', icon: Zap, color: 'text-yellow-600' },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-orange-600' }
  ];

  // Pre-populated emergency numbers for Nigeria
  const defaultContacts = [
    {
      title: 'Nigeria Police Force',
      contactType: 'police',
      phoneNumber: '199',
      description: 'National emergency police line',
      availability: '24/7',
      isVerified: true,
      isEmergencyOnly: true,
      isDefault: true
    },
    {
      title: 'Federal Fire Service',
      contactType: 'fire', 
      phoneNumber: '199',
      description: 'National fire emergency service',
      availability: '24/7',
      isVerified: true,
      isEmergencyOnly: true,
      isDefault: true
    },
    {
      title: 'Lagos State Emergency',
      contactType: 'medical',
      phoneNumber: '767',
      alternatePhone: '199',
      description: 'Lagos State Emergency Response',
      availability: '24/7',
      isVerified: true,
      isEmergencyOnly: true,
      isDefault: true
    },
    {
      title: 'NEMA (National Emergency)',
      contactType: 'medical',
      phoneNumber: '112',
      description: 'National Emergency Management Agency',
      availability: '24/7',
      isVerified: true,
      isEmergencyOnly: true,
      isDefault: true
    }
  ];

  useEffect(() => {
    if (communityId) {
      loadEmergencyContacts();
    }
  }, [communityId]);

  const loadEmergencyContacts = async () => {
    try {
      const response = await authenticatedFetch(`/api/hub/emergency?communityId=${communityId}&type=contact`);
      const result = await response.json();

      if (result.success) {
        // Combine default contacts with community contacts
        const communityContacts = result.data;
        const allContacts = [...defaultContacts, ...communityContacts];
        setContacts(allContacts);
      } else {
        // If API fails, show default contacts
        setContacts(defaultContacts);
      }
    } catch (error) {
      console.error('Error loading emergency contacts:', error);
      // Fallback to default contacts
      setContacts(defaultContacts);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to add emergency contact');
      return;
    }

    try {
      const contactData = {
        communityId,
        type: 'contact',
        title: formData.title,
        description: formData.description,
        contactInfo: {
          type: formData.contactType,
          phoneNumber: formData.phoneNumber,
          alternatePhone: formData.alternatePhone,
          email: formData.email,
          address: formData.address,
          availability: formData.availability,
          isVerified: formData.isVerified,
          isEmergencyOnly: formData.isEmergencyOnly
        },
        priority: 'medium',
        status: 'active'
      };

      const response = await authenticatedFetch('/api/hub/emergency', {
        method: 'POST',
        body: JSON.stringify(contactData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Emergency contact added!');
        setShowAddForm(false);
        resetForm();
        loadEmergencyContacts();
      } else {
        toast.error(result.error || 'Failed to add contact');
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      toast.error('Error adding emergency contact');
    }
  };

  const handleEditContact = async (e) => {
    e.preventDefault();
    
    if (!editingContact || !user) return;

    try {
      const response = await authenticatedFetch('/api/hub/emergency', {
        method: 'PUT',
        body: JSON.stringify({
          recordId: editingContact.id,
          action: 'update_status',
          contactInfo: {
            type: formData.contactType,
            phoneNumber: formData.phoneNumber,
            alternatePhone: formData.alternatePhone,
            email: formData.email,
            address: formData.address,
            availability: formData.availability,
            isVerified: formData.isVerified,
            isEmergencyOnly: formData.isEmergencyOnly
          },
          title: formData.title,
          description: formData.description
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Contact updated!');
        setEditingContact(null);
        resetForm();
        loadEmergencyContacts();
      } else {
        toast.error(result.error || 'Failed to update contact');
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Error updating contact');
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!user || !confirm('Are you sure you want to delete this emergency contact?')) return;

    try {
      const response = await authenticatedFetch(`/api/hub/emergency?recordId=${contactId}&userId=${user.uid}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Contact deleted');
        loadEmergencyContacts();
      } else {
        toast.error(result.error || 'Failed to delete contact');
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Error deleting contact');
    }
  };

  const handleQuickCall = (phoneNumber, contactName) => {
    if (confirm(`Call ${contactName} at ${phoneNumber}?`)) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      contactType: 'police',
      phoneNumber: '',
      alternatePhone: '',
      email: '',
      address: '',
      availability: '24/7',
      isVerified: false,
      isEmergencyOnly: true
    });
  };

  const startEdit = (contact) => {
    if (contact.isDefault) return; // Can't edit default contacts
    
    setEditingContact(contact);
    setFormData({
      title: contact.title,
      description: contact.description || '',
      contactType: contact.contactType || contact.contactInfo?.type || 'police',
      phoneNumber: contact.phoneNumber || contact.contactInfo?.phoneNumber || '',
      alternatePhone: contact.alternatePhone || contact.contactInfo?.alternatePhone || '',
      email: contact.email || contact.contactInfo?.email || '',
      address: contact.address || contact.contactInfo?.address || '',
      availability: contact.availability || contact.contactInfo?.availability || '24/7',
      isVerified: contact.isVerified || contact.contactInfo?.isVerified || false,
      isEmergencyOnly: contact.isEmergencyOnly || contact.contactInfo?.isEmergencyOnly || true
    });
    setShowAddForm(true);
  };

  const filteredContacts = contacts.filter(contact => 
    selectedCategory === 'all' || 
    contact.contactType === selectedCategory ||
    contact.contactInfo?.type === selectedCategory
  );

  const getCategoryIcon = (type) => {
    const category = categories.find(c => c.id === type);
    if (!category) return Phone;
    return category.icon;
  };

  const getCategoryColor = (type) => {
    const category = categories.find(c => c.id === type);
    if (!category) return 'text-gray-600';
    return category.color;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Emergency Header */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-full bg-red-100 text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Emergency Response Network</h3>
            <p className="text-red-700">Quick access to emergency contacts and services</p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {defaultContacts.slice(0, 4).map((contact, index) => {
            const IconComponent = getCategoryIcon(contact.contactType);
            return (
              <button
                key={index}
                onClick={() => handleQuickCall(contact.phoneNumber, contact.title)}
                className="flex items-center space-x-2 bg-white border border-red-200 p-3 rounded-lg hover:bg-red-50 transition-colors"
              >
                <IconComponent className={`w-5 h-5 ${getCategoryColor(contact.contactType)}`} />
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">{contact.title}</div>
                  <div className="text-xs text-gray-600">{contact.phoneNumber}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span className="text-sm">{category.label}</span>
              </button>
            );
          })}
        </div>
        
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingContact(null);
            resetForm();
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
          </h3>
          
          <form onSubmit={editingContact ? handleEditContact : handleAddContact} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name/Organization
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Ikeja Police Station"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.contactType}
                  onChange={(e) => setFormData({...formData, contactType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.slice(1).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  placeholder="e.g., 08012345678"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alternate Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.alternatePhone}
                  onChange={(e) => setFormData({...formData, alternatePhone: e.target.value})}
                  placeholder="e.g., 08098765432"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Additional information about this contact..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="contact@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Location or address"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Availability
                </label>
                <select
                  value={formData.availability}
                  onChange={(e) => setFormData({...formData, availability: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="24/7">24/7</option>
                  <option value="Business Hours">Business Hours</option>
                  <option value="Emergency Only">Emergency Only</option>
                  <option value="Weekdays Only">Weekdays Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isVerified}
                  onChange={(e) => setFormData({...formData, isVerified: e.target.checked})}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Verified Contact</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isEmergencyOnly}
                  onChange={(e) => setFormData({...formData, isEmergencyOnly: e.target.checked})}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Emergency Use Only</span>
              </label>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                {editingContact ? 'Update Contact' : 'Add Contact'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingContact(null);
                  resetForm();
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-4">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Emergency Contacts</h3>
            <p className="text-gray-600 mb-4">
              Add emergency contacts for your community to ensure quick response during emergencies.
            </p>
          </div>
        ) : (
          filteredContacts.map((contact, index) => {
            const IconComponent = getCategoryIcon(contact.contactType || contact.contactInfo?.type);
            const phoneNumber = contact.phoneNumber || contact.contactInfo?.phoneNumber;
            const altPhone = contact.alternatePhone || contact.contactInfo?.alternatePhone;
            const isVerified = contact.isVerified || contact.contactInfo?.isVerified;
            const availability = contact.availability || contact.contactInfo?.availability || '24/7';
            
            return (
              <div key={contact.id || index} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`p-2 rounded-full bg-gray-100 ${getCategoryColor(contact.contactType || contact.contactInfo?.type)}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold flex items-center space-x-2">
                          <span>{contact.title}</span>
                          {isVerified && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {contact.isDefault && <Star className="w-4 h-4 text-yellow-600" />}
                        </h3>
                        {contact.description && (
                          <p className="text-gray-600 text-sm mt-1">{contact.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{phoneNumber}</span>
                          <button
                            onClick={() => handleQuickCall(phoneNumber, contact.title)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <PhoneCall className="w-4 h-4" />
                          </button>
                        </div>
                        {altPhone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{altPhone}</span>
                            <button
                              onClick={() => handleQuickCall(altPhone, contact.title)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <PhoneCall className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>{availability}</span>
                        </div>
                        {(contact.address || contact.contactInfo?.address) && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600 text-sm">{contact.address || contact.contactInfo?.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleQuickCall(phoneNumber, contact.title)}
                      className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      title="Call Now"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                    
                    {!contact.isDefault && (
                      <>
                        <button
                          onClick={() => startEdit(contact)}
                          className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                          title="Edit Contact"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default EmergencyContacts;