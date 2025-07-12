import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Dimensions,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { findOptimalMeetingPoint } from '@/services/meetingPointApi';
import { defaultMapCenter, defaultMapZoom } from '@/config';
import { MetroBackground, GradientView } from '@/components/core';
import { GRADIENT_STYLES } from '@/theme/gradients';
import MapContainer from '@/components/maps/MapContainer';
import { SlideToConfirm, LoadingIndicator } from '@/components/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/contexts/GroupsContext';
import RouteDetailsToggle from '@/components/meeting/RouteDetailsToggle';
import CompactActionsCard from '@/components/meeting/CompactActionsCard';

const { width: screenWidth } = Dimensions.get('window');

interface GroupMember {
    id: string;
    user_id: string | null;
    display_name: string;
    phone_number: string | null;
    role: 'member' | 'location';
    joined_at: string;
    is_me: boolean;
    attendance?: {
        isAttending: boolean;
        confirmedAt: string;
        location_lat?: number;
        location_lng?: number;
    };
    type?: 'user' | 'custom_location';
    address?: string;
    coordinates?: [number, number];
    created_by?: string;
}

function MapDisplay({ meetingPoint, routes, attendeeAddresses, currentGroup, onBackPress, onSettingsPress }: {
    meetingPoint: any,
    routes: any[],
    attendeeAddresses: any[],
    currentGroup: any,
    onBackPress: () => void,
    onSettingsPress: () => void
}) {
    const [mapReady, setMapReady] = useState(false);
    const [mapExpanded, setMapExpanded] = useState(false);
    const [stableRoutes, setStableRoutes] = useState<any[]>([]);
    const routeUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastValidRoutesRef = useRef<any[]>([]);

    const handleMapReady = () => {
        setMapReady(true);
    };

    const toggleMapExpanded = () => {
        setMapExpanded(!mapExpanded);
    };

    // Safely validate and process routes while preserving all properties
    const validateRoutes = useCallback((inputRoutes: any[]): any[] => {
        if (!Array.isArray(inputRoutes)) {
            return lastValidRoutesRef.current;
        }

        if (inputRoutes.length === 0) {
            return [];
        }

        const validatedRoutes = inputRoutes.map((route, index) => {
            if (!route) {
                return null;
            }
            
            // Always return the complete route with all properties preserved
            const validatedRoute = {
                ...route,
                // Ensure we have all the properties the MapContainer expects
                id: route.id || `route-${index}`,
                color: route.color || '#6366f1', // Default color if missing
                mode: route.mode || 'unknown',
                weight: route.weight || 5,
                opacity: route.opacity || 0.8,
                geometry: route.geometry || { coordinates: [] }
            };
            
            return validatedRoute;
        }).filter(route => route !== null);
        
        return validatedRoutes;
    }, []);

    // Simplified route update logic - only one useEffect to handle all updates
    useEffect(() => {
        
        // Clear existing timeout
        if (routeUpdateTimeoutRef.current) {
            clearTimeout(routeUpdateTimeoutRef.current);
        }

        const validatedRoutes = validateRoutes(routes);
        
        // If we have valid routes, set them immediately for first load
        if (stableRoutes.length === 0 && validatedRoutes.length > 0) {
            setStableRoutes(validatedRoutes);
            return;
        }
        
        // For subsequent updates, use a short debounce to prevent rapid changes during swiping
        routeUpdateTimeoutRef.current = setTimeout(() => {
            setStableRoutes(validatedRoutes);
        }, 150); // Slightly longer debounce for stability

        return () => {
            if (routeUpdateTimeoutRef.current) {
                clearTimeout(routeUpdateTimeoutRef.current);
            }
        };
    }, [routes, validateRoutes, stableRoutes.length]);

    // Create markers for the map
    const markers = React.useMemo(() => {
        const allMarkers = [];

        // Add attendee markers
        attendeeAddresses.forEach((addr, index) => {
            if (addr && addr.lat && addr.lng && typeof addr.lat === 'number' && typeof addr.lng === 'number') {
                allMarkers.push({
                    position: [addr.lng, addr.lat],
                    title: addr.name || `Attendee ${index + 1}`,
                    type: 'location',
                    number: index + 1
                });
            }
        });

        // Add meeting point marker
        if (meetingPoint && meetingPoint.coordinates && Array.isArray(meetingPoint.coordinates) && meetingPoint.coordinates.length >= 2) {
            allMarkers.push({
                position: meetingPoint.coordinates,
                title: meetingPoint.name || 'Meeting Point',
                type: 'meeting-point',
                info: `Meeting Point: ${meetingPoint.name || 'Unknown'}`
            });
        }

        return allMarkers;
    }, [meetingPoint, attendeeAddresses]);

    return (
        <View style={[styles.mapContainer, { height: mapExpanded ? 400 : 320 }]}>
            {/* Floating Header Controls */}
            <View style={styles.headerControls}>
                <GradientView
                    gradientName="lightBlue"
                    style={[styles.headerButton, GRADIENT_STYLES.card]}
                >
                    <TouchableOpacity
                        style={styles.headerButtonContent}
                        onPress={onBackPress}
                    >
                        <MaterialIcons name="arrow-back" size={20} color="#111827" />
                    </TouchableOpacity>
                </GradientView>
                
                <GradientView
                    gradientName="lightPurple"
                    style={[styles.groupTitleContainer, GRADIENT_STYLES.header]}
                >
                    <Text style={styles.floatingGroupTitle} numberOfLines={1}>
                        {currentGroup?.name || 'Group'}
                    </Text>
                </GradientView>
                
                <View style={styles.rightButtons}>
                    <GradientView
                        gradientName="lightBlue"
                        style={[styles.headerButton, GRADIENT_STYLES.card]}
                    >
                        <TouchableOpacity
                            style={styles.headerButtonContent}
                            onPress={toggleMapExpanded}
                        >
                            <MaterialIcons 
                                name={mapExpanded ? "fullscreen-exit" : "fullscreen"} 
                                size={20} 
                                color="#6b7280" 
                            />
                        </TouchableOpacity>
                    </GradientView>
                    <GradientView
                        gradientName="lightBlue"
                        style={[styles.headerButton, GRADIENT_STYLES.card]}
                    >
                        <TouchableOpacity
                            style={styles.headerButtonContent}
                            onPress={onSettingsPress}
                        >
                            <MaterialIcons name="settings" size={20} color="#6b7280" />
                        </TouchableOpacity>
                    </GradientView>
                </View>
            </View>

            <MapContainer
                center={meetingPoint && meetingPoint.coordinates ? meetingPoint.coordinates : [2.3522, 48.8566]}
                markers={markers}
                routes={stableRoutes}
                onMapReady={handleMapReady}
                height="100%"
                zoomToFitMarkers={mapReady}
            />
        </View>
    );
}





export default function GroupScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user, addresses } = useAuth();
    const {
        currentGroup,
        currentGroupMembers,
        loading,
        error,
        loadGroup,
        loadGroupMembers,
        updateMyAttendance,
        getMyAttendance,
        getUserAddresses,
        getGroupMemberAddresses,
        clearError,
    } = useGroups();

    const [myAttendance, setMyAttendance] = useState<any | null>(null);
    const [meetingPoint, setMeetingPoint] = useState<any | null>(null);
    const [attendeeAddresses, setAttendeeAddresses] = useState<any[]>([]);
    const [isCalculatingMeetingPoint, setIsCalculatingMeetingPoint] = useState(false);
    const [currentMeetingPointIndex, setCurrentMeetingPointIndex] = useState(0);

    // Load group data when component mounts
    useEffect(() => {
        if (id && user) {
            loadGroup(id);
            loadMyAttendance();
        }
    }, [id, user, loadGroup]);

    // Reload group members when group changes
    useEffect(() => {
        if (currentGroup?.id && user) {
            loadGroupMembers(currentGroup.id);
        }
    }, [currentGroup?.id, user, loadGroupMembers]);

    // Load current user's attendance
    const loadMyAttendance = useCallback(async () => {
        if (!id || !user) return;

        try {
            const attendance = await getMyAttendance(id);
            setMyAttendance(attendance);
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    }, [id, user, getMyAttendance]);

    // Calculate meeting point when we have enough attendees
    const calculateMeetingPoint = useCallback(async () => {
        if (!currentGroupMembers.length || !currentGroup?.id) return;

        const attendees = currentGroupMembers.filter(member => member.attendance?.isAttending);

        if (attendees.length < 2) {
            setMeetingPoint(null);
            return;
        }

        setIsCalculatingMeetingPoint(true);
        try {
            const userAddressesMap = await getGroupMemberAddresses(currentGroup.id);
            const attendeeAddresses = [];

            for (const attendee of attendees) {
                if (attendee.type === 'custom_location') {
                    // Handle custom locations - they already have coordinates
                    if (attendee.coordinates && attendee.coordinates.length >= 2) {
                        attendeeAddresses.push({
                            address: attendee.address || attendee.display_name,
                            lat: attendee.coordinates[1], // [lng, lat] format
                            lng: attendee.coordinates[0],
                            name: attendee.display_name,
                            type: 'custom_location'
                        });
                    }
                } else if (attendee.is_me) {
                    // Handle current user
                    const userAddress = addresses?.find(addr => addr.is_default) || addresses?.[0];
                    if (userAddress) {
                        attendeeAddresses.push({
                            address: userAddress.formatted_address || userAddress.name || `${userAddress.latitude}, ${userAddress.longitude}`,
                            lat: userAddress.latitude,
                            lng: userAddress.longitude,
                            name: attendee.display_name || 'You',
                            type: 'user'
                        });
                    }
                } else if (attendee.user_id) {
                    // Handle other users
                    const userAddress = userAddressesMap[attendee.user_id];
                    if (userAddress) {
                        attendeeAddresses.push({
                            address: userAddress.address,
                            lat: userAddress.latitude,
                            lng: userAddress.longitude,
                            name: attendee.display_name || 'User',
                            type: 'user'
                        });
                    } else {
                        // Fallback for users without addresses (if current user has address)
                        const currentUserAddress = addresses?.find(addr => addr.is_default) || addresses?.[0];
                        if (currentUserAddress) {
                            const latOffset = (Math.random() - 0.5) * 0.02;
                            const lngOffset = (Math.random() - 0.5) * 0.02;
                            attendeeAddresses.push({
                                address: `${attendee.display_name}'s Location (estimated)`,
                                lat: currentUserAddress.latitude + latOffset,
                                lng: currentUserAddress.longitude + lngOffset,
                                name: attendee.display_name || 'User',
                                type: 'user'
                            });
                        }
                    }
                }
            }

            // Store attendee addresses for the map
            setAttendeeAddresses(attendeeAddresses);

            if (attendeeAddresses.length < 2) {
                setMeetingPoint(null);
                return;
            }

            const apiAddresses = attendeeAddresses
                .filter(addr => addr.address && addr.lat && addr.lng)
                .map((addr, index) => ({
                    id: `addr-${index}`,
                    value: addr.address,
                    coordinates: [addr.lng, addr.lat]
                }));

            if (apiAddresses.length < 2) {
                setMeetingPoint(null);
                return;
            }

            const result = await findOptimalMeetingPoint(apiAddresses, {
                transportation_mode: 'transit',
                venue_types: ['restaurant', 'cafe', 'bar'],
                search_radius: 1000
            });

            setMeetingPoint(result);
        } catch (error) {
            console.error('Error calculating meeting point:', error);
            setMeetingPoint(null);
        } finally {
            setIsCalculatingMeetingPoint(false);
        }
    }, [currentGroupMembers, addresses, getGroupMemberAddresses, currentGroup]);

    useEffect(() => {
        calculateMeetingPoint();
    }, [calculateMeetingPoint]);

    const handleAttendanceConfirm = useCallback(async () => {
        if (!currentGroup || !user) return;

        try {
            const defaultAddress = addresses.find(addr => addr.is_default) || addresses[0];
            const location = defaultAddress ? {
                lat: defaultAddress.latitude,
                lng: defaultAddress.longitude,
            } : null;

            const success = await updateMyAttendance(currentGroup.id, true, location);

            if (success) {
                await Promise.all([
                    loadMyAttendance(),
                    loadGroupMembers(currentGroup.id)
                ]);
            }
        } catch (error) {
            console.error('Error confirming attendance:', error);
            Alert.alert('Error', 'Failed to confirm attendance. Please try again.');
        }
    }, [currentGroup, user, addresses, updateMyAttendance, loadMyAttendance]);

    const handleAttendanceCancel = useCallback(async () => {
        if (!currentGroup || !user) return;

        try {
            const success = await updateMyAttendance(currentGroup.id, false, null);

            if (success) {
                await Promise.all([
                    loadMyAttendance(),
                    loadGroupMembers(currentGroup.id)
                ]);
            }
        } catch (error) {
            console.error('Error cancelling attendance:', error);
            Alert.alert('Error', 'Failed to cancel attendance. Please try again.');
        }
    }, [currentGroup, user, updateMyAttendance, loadMyAttendance]);

    const handleSettingsPress = useCallback(() => {
        if (!currentGroup) return;
        router.push(`/groups/${currentGroup.id}/settings`);
    }, [currentGroup]);

    useEffect(() => {
        return () => {
            if (error) {
                clearError();
            }
        };
    }, [error, clearError]);

    // Helper function to get current meeting point
    const getCurrentMeetingPoint = () => {
        if (!meetingPoint) return null;
        const meetingPoints = meetingPoint.allMeetingPoints || [meetingPoint];
        return meetingPoints[currentMeetingPointIndex] || meetingPoint;
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorState}>
                    <MaterialIcons name="error" size={48} color="#ef4444" />
                    <Text style={styles.errorTitle}>Authentication Required</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!currentGroup && !loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorState}>
                    <MaterialIcons name="group" size={48} color="#9ca3af" />
                    <Text style={styles.errorTitle}>Group Not Found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const attendingMembers = currentGroupMembers.filter(m => m.attendance?.isAttending);
    const needsMoreAttendees = attendingMembers.length < 2;

    return (
        <View style={styles.container}>
            {/* Background */}
            <View style={styles.backgroundContainer}>
                <MetroBackground />
            </View>

            <View style={styles.mainContent}>
                {/* Full Screen Map with Floating Header */}
                <MapDisplay
                    meetingPoint={meetingPoint ? (meetingPoint.allMeetingPoints?.[currentMeetingPointIndex] || meetingPoint) : null}
                    routes={meetingPoint ? (meetingPoint.allMeetingPoints?.[currentMeetingPointIndex]?.routes || meetingPoint.routes || []) : []}
                    attendeeAddresses={attendeeAddresses}
                    currentGroup={currentGroup}
                    onBackPress={() => router.back()}
                    onSettingsPress={handleSettingsPress}
                />

                {/* Compact Content Below Map */}
                <SafeAreaView style={styles.contentSafeArea} edges={['left', 'right', 'bottom']}>
                    <View style={styles.compactContent}>
                        {/* Slide to Confirm */}
                        <View style={styles.slideContainer}>
                            <SlideToConfirm
                                text="I'm attending!"
                                cancelText="I can't make it"
                                onConfirm={handleAttendanceConfirm}
                                onCancel={handleAttendanceCancel}
                                isConfirmed={myAttendance?.is_attending || false}
                                disabled={loading}
                            />
                        </View>

                        {/* Attendees Count Button */}
                        <TouchableOpacity 
                            style={styles.attendeesButton}
                            onPress={handleSettingsPress}
                        >
                            <View style={styles.attendeesButtonContent}>
                                <MaterialIcons name="people" size={20} color="#6b7280" />
                                <Text style={styles.attendeesButtonText}>
                                    Attendees ({currentGroupMembers.filter(m => m.attendance?.isAttending).length}/{currentGroupMembers.length})
                                </Text>
                                <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
                            </View>
                        </TouchableOpacity>

                        {/* Action Buttons */}
                        {meetingPoint && (
                            <CompactActionsCard
                                meetingPoint={meetingPoint}
                                travelTimes={meetingPoint.travelTimes || []}
                                addresses={attendeeAddresses}
                                mode="group"
                            />
                        )}

                        {/* Route Details Toggle */}
                        {meetingPoint && meetingPoint.routes && meetingPoint.routes.length > 0 && (
                            <RouteDetailsToggle
                                routes={meetingPoint.routes}
                                travelTimes={meetingPoint.travelTimes || []}
                            />
                        )}
                    </View>
                </SafeAreaView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    backgroundContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1, // Ensure it's behind everything
    },
    mainContent: {
        flex: 1,
        zIndex: 1,
        position: 'relative',
        backgroundColor: 'transparent', // Ensure no background blocks the metro background
    },
    contentSafeArea: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    compactContent: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    slideContainer: {
        marginBottom: 16,
    },
    attendeesButton: {
        marginBottom: 16,
    },
    attendeesButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
    },
    attendeesButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 8,
    },
    statsSection: {
        marginBottom: 16,
    },
    statsContainer: {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#6366f1',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
        textAlign: 'center',
    },
    statUnit: {
        fontSize: 10,
        fontWeight: '500',
        color: '#64748b',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        marginHorizontal: 16,
    },
    headerControls: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 16,
        right: 16,
        zIndex: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
      headerButton: {
    borderRadius: 16,
    width: 42,
    height: 42,
  },
  headerButtonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
      groupTitleContainer: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: '60%',
  },
    floatingGroupTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    rightButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    mapContainer: {
        marginVertical: 0,
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    mapPlaceholder: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
    },
    mapPlaceholderText: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 8,
        textAlign: 'center',
    },
    routeCount: {
        fontSize: 12,
        color: '#6366f1',
        marginTop: 4,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
    },
    loadingText: {
        fontSize: 18,
        color: '#6366f1',
        fontWeight: '600',
    },
    needMoreContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    needMoreTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
    needMoreText: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
    },


    errorState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 16,
    },

}); 