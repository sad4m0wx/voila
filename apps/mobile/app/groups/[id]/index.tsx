import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Dimensions,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../lib/contexts/AuthContext';
import { useGroups } from '../../../lib/contexts/GroupsContext';
import SlideToConfirm from '../../../lib/components/utils/SlideToConfirm';
import MapContainer from '../../../lib/components/maps/MapContainer';
import { MeetingPointResults } from '../../../lib';
import { findOptimalMeetingPoint } from '../../../lib/services/meetingPointApi';

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
            console.log('⚠️ Routes is not an array, returning last valid routes');
            return lastValidRoutesRef.current;
        }

        if (inputRoutes.length === 0) {
            console.log('⚠️ Empty routes array received');
            return [];
        }

        const validatedRoutes = inputRoutes.map((route, index) => {
            if (!route) {
                console.log(`⚠️ Skipping null/undefined route at index ${index}`);
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
            console.log('🚀 First load - setting routes immediately');
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
                <TouchableOpacity
                    style={styles.headerButton}
                    onPress={onBackPress}
                >
                    <MaterialIcons name="arrow-back" size={20} color="#111827" />
                </TouchableOpacity>
                
                <View style={styles.groupTitleContainer}>
                    <Text style={styles.floatingGroupTitle} numberOfLines={1}>
                        {currentGroup?.name || 'Group'}
                    </Text>
                </View>
                
                <View style={styles.rightButtons}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={toggleMapExpanded}
                    >
                        <MaterialIcons 
                            name={mapExpanded ? "fullscreen-exit" : "fullscreen"} 
                            size={20} 
                            color="#6b7280" 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={onSettingsPress}
                    >
                        <MaterialIcons name="settings" size={20} color="#6b7280" />
                    </TouchableOpacity>
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

function AttendeesList({ members, isExpanded, onToggle }: {
    members: GroupMember[],
    isExpanded: boolean,
    onToggle: () => void
}) {
    const attendingCount = members.filter(m => m.attendance?.isAttending).length;

    return (
        <View style={styles.attendeesContainer}>
            <TouchableOpacity style={styles.attendeesHeader} onPress={onToggle}>
                <View style={styles.attendeesHeaderLeft}>
                    <MaterialIcons name="people" size={20} color="#6b7280" />
                    <Text style={styles.attendeesTitle}>
                        Attendees ({attendingCount}/{members.length})
                    </Text>
                </View>
                <MaterialIcons
                    name={isExpanded ? "expand-less" : "expand-more"}
                    size={24}
                    color="#6b7280"
                />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.attendeesList}>
                    {members.map((member) => (
                        <View key={member.id} style={styles.attendeeItem}>
                            <View style={styles.attendeeInfo}>
                                <View style={[
                                    styles.attendeeAvatar,
                                    member.type === 'custom_location' && styles.customLocationAvatar
                                ]}>
                                    <MaterialIcons 
                                        name={member.type === 'custom_location' ? "place" : "person"} 
                                        size={16} 
                                        color={member.type === 'custom_location' ? "#f59e0b" : "#6366f1"} 
                                    />
                                </View>
                                <View style={styles.attendeeDetails}>
                                    <Text style={styles.attendeeName} numberOfLines={1}>
                                        {member.display_name || 'Unknown'}
                                        {member.is_me && ' (You)'}
                                    </Text>
                                    {member.type === 'custom_location' && (
                                        <Text style={styles.attendeeType} numberOfLines={1}>
                                            Custom Location{member.created_by ? ` • Added by ${member.created_by}` : ''}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.attendeeStatus}>
                                {member.attendance?.isAttending !== undefined ? (
                                    <MaterialIcons
                                        name={member.attendance.isAttending ? "check-circle" : "cancel"}
                                        size={18}
                                        color={member.attendance.isAttending ? "#10b981" : "#ef4444"}
                                    />
                                ) : (
                                    <MaterialIcons name="help" size={18} color="#9ca3af" />
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            )}
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

    const [refreshing, setRefreshing] = useState(false);
    const [myAttendance, setMyAttendance] = useState<any | null>(null);
    const [meetingPoint, setMeetingPoint] = useState<any | null>(null);
    const [attendeeAddresses, setAttendeeAddresses] = useState<any[]>([]);
    const [isCalculatingMeetingPoint, setIsCalculatingMeetingPoint] = useState(false);
    const [attendeesExpanded, setAttendeesExpanded] = useState(false);
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
            console.log('🔄 Reloading group members after group update...');
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

    const onRefresh = useCallback(async () => {
        if (!id) return;

        setRefreshing(true);
        try {
            await Promise.all([
                loadGroup(id),
                loadMyAttendance()
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [id, loadGroup, loadMyAttendance]);

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
            {/* Full Screen Map with Floating Header */}
            <MapDisplay
                meetingPoint={meetingPoint ? (meetingPoint.allMeetingPoints?.[currentMeetingPointIndex] || meetingPoint) : null}
                routes={meetingPoint ? (meetingPoint.allMeetingPoints?.[currentMeetingPointIndex]?.routes || meetingPoint.routes || []) : []}
                attendeeAddresses={attendeeAddresses}
                currentGroup={currentGroup}
                onBackPress={() => router.back()}
                onSettingsPress={handleSettingsPress}
            />

            {/* Content Below Map */}
            <SafeAreaView style={styles.contentSafeArea} edges={['left', 'right', 'bottom']}>
                <ScrollView
                    style={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >

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

                {/* Meeting Point Results */}
                {meetingPoint && (
                    <MeetingPointResults
                        meetingPoint={meetingPoint}
                        meetingPoints={meetingPoint.allMeetingPoints || [meetingPoint]}
                        currentMeetingPointIndex={currentMeetingPointIndex}
                        setCurrentMeetingPointIndex={setCurrentMeetingPointIndex}
                        mode="group"
                    />
                )}

                {/* Attendees List */}
                <AttendeesList
                    members={currentGroupMembers}
                    isExpanded={attendeesExpanded}
                    onToggle={() => setAttendeesExpanded(!attendeesExpanded)}
                />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentSafeArea: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 32,
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
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 16,
        width: 42,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    groupTitleContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
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
    slideContainer: {
        paddingHorizontal: 16,
        paddingVertical: 20,
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
    resultsContainer: {
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    swipeableContainer: {
        marginBottom: 16,
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 8,
        flex: 1,
    },
    locationName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    venuesSection: {
        marginTop: 8,
    },
    venuesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    venuesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    venueChip: {
        backgroundColor: '#ecfdf5',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
        maxWidth: (screenWidth - 64) / 2,
    },
    venueName: {
        fontSize: 12,
        color: '#065f46',
        fontWeight: '500',
    },
    fallbackNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        borderRadius: 8,
        padding: 8,
        marginTop: 12,
        gap: 6,
    },
    fallbackText: {
        fontSize: 12,
        color: '#d97706',
        fontStyle: 'italic',
    },
    attendeesContainer: {
        marginTop: 24,
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    attendeesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 4,
    },
    attendeesHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    attendeesTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    attendeesList: {
        paddingHorizontal: 4,
        paddingBottom: 8,
        gap: 12,
    },
    attendeeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    attendeeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    attendeeAvatar: {
        backgroundColor: '#e0e7ff',
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customLocationAvatar: {
        backgroundColor: '#fef3c7',
    },
    attendeeDetails: {
        flex: 1,
    },
    attendeeName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    attendeeType: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 2,
    },
    attendeeStatus: {
        marginLeft: 8,
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