import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { defaultMapCenter, defaultMapZoom } from '@/config';
import { MetroBackground, GradientView } from '@/components/core';
import { GRADIENT_STYLES } from '@/theme/gradients';
import MapContainer from '@/components/maps/MapContainer';
import { SlideToConfirm, LoadingIndicator } from '@/components/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/contexts/GroupsContext';
import { useMeetingPoint } from '@/contexts/MeetingPointContext';
import { useGroupMembers } from '@/contexts/GroupMembersContext';
import { useGroupAttendance } from '@/contexts/GroupAttendanceContext';
import groupsService from '@/services/groupsService';
import MeetingPointResults from '@/components/meeting/MeetingPointResults';

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
    const [stableRoutes, setStableRoutes] = useState<any[]>([]);
    const [stableMarkers, setStableMarkers] = useState<any[]>([]);
    const [stableCenter, setStableCenter] = useState<[number, number]>([2.3522, 48.8566]);
    const routeUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastValidRoutesRef = useRef<any[]>([]);

    const handleMapReady = () => {
        setMapReady(true);
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

    // Create markers for the map
    const createMarkers = useCallback(() => {
        const allMarkers = [];
        let count = 0;

        // Add attendee markers
        attendeeAddresses.forEach((addr) => {
            if (addr && addr.lat && addr.lng && typeof addr.lat === 'number' && typeof addr.lng === 'number') {
                const marker = {
                    position: [addr.lng, addr.lat],
                    title: addr.name || `Attendee ${count + 1}`,
                    type: 'location',
                    number: (count += 1)
                };
                allMarkers.push(marker);
            }
        });

        // Add meeting point marker
        if (meetingPoint && meetingPoint.coordinates && Array.isArray(meetingPoint.coordinates) && meetingPoint.coordinates.length >= 2) {
            const meetingMarker = {
                position: meetingPoint.coordinates,
                title: meetingPoint.name || 'Meeting Point',
                type: 'meeting-point',
                info: `Meeting Point: ${meetingPoint.name || 'Unknown'}`
            };
            allMarkers.push(meetingMarker);
        }

        return allMarkers;
    }, [meetingPoint, attendeeAddresses]);

    // Get center position
    const getCenterPosition = useCallback(() => {
        return meetingPoint && meetingPoint.coordinates ? meetingPoint.coordinates : [2.3522, 48.8566];
    }, [meetingPoint]);

    // Synchronized update logic for routes, markers, and center
    useEffect(() => {
        // Clear existing timeout
        if (routeUpdateTimeoutRef.current) {
            clearTimeout(routeUpdateTimeoutRef.current);
        }

        const validatedRoutes = validateRoutes(routes);
        const newMarkers = createMarkers();
        const newCenter = getCenterPosition();

        if (validatedRoutes.length > 0 || newMarkers.length > 0) {
            setStableRoutes(validatedRoutes);
            setStableMarkers(newMarkers);
            setStableCenter(newCenter);
            return;
        }

        setStableRoutes([]);
        setStableMarkers([]);
        setStableCenter(newCenter);

        return () => {
            if (routeUpdateTimeoutRef.current) {
                clearTimeout(routeUpdateTimeoutRef.current);
            }
        };
    }, [routes, validateRoutes, createMarkers, getCenterPosition]);

    return (
        <View style={[styles.mapContainer, { height: 280 }]}>
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
                            onPress={onSettingsPress}
                        >
                            <MaterialIcons name="settings" size={20} color="#6b7280" />
                        </TouchableOpacity>
                    </GradientView>
                </View>
            </View>

            <MapContainer
                center={stableCenter}
                markers={stableMarkers}
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
        loading: groupsLoading,
        error: groupsError,
        loadGroup,
        clearError: clearGroupsError,
    } = useGroups();

    const {
        getGroupMembers,
        loadGroupMembers,
        loading: membersLoading,
        error: membersError,
        clearError: clearMembersError,
    } = useGroupMembers();

    const {
        updateMyAttendance,
        loading: attendanceLoading,
        error: attendanceError,
    } = useGroupAttendance();

    // Memoize currentGroupMembers and addresses to prevent unnecessary re-renders
    const currentGroupMembers = useMemo(() => getGroupMembers(id), [getGroupMembers, id]);
    const memoizedAddresses = useMemo(() => addresses, [addresses]);

    const {
        calculateMeetingPoint,
        getCachedMeetingPoint,
        isCalculatingMeetingPoint,
    } = useMeetingPoint();

    const isLoading = groupsLoading || membersLoading || attendanceLoading;
    const error = groupsError || membersError || attendanceError;

    const clearError = useCallback(() => {
        clearGroupsError();
        clearMembersError();
      }, [clearGroupsError, clearMembersError]);
    


    // [REFACTOR START]
    // --- State ---
    const [meetingPoint, setMeetingPoint] = useState(null);
    const [attendeeAddresses, setAttendeeAddresses] = useState([]);
    const [currentMeetingPointIndex, setCurrentMeetingPointIndex] = useState(0);
    const [hasInitialMeetingPoint, setHasInitialMeetingPoint] = useState(false);

    // --- Centralized Data Loading ---
    const loadAllData = useCallback(async () => {
        if (!id || !user) return;
        
        try {
          await Promise.all([
            loadGroup(id),
            loadGroupMembers(id)
          ]);
        } catch (error) {
          console.error('Error loading group data:', error);
        }
      }, [id, user, loadGroup, loadGroupMembers]);
    



    useEffect(() => {
        loadAllData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, user]);

    // --- Immediate Cache Check and Async Calculation ---
    useEffect(() => {
        if (!currentGroup || !currentGroupMembers || !memoizedAddresses) return;

        // First, check cache immediately for instant UI update
        const cachedResult = getCachedMeetingPoint(currentGroupMembers, memoizedAddresses);
        if (cachedResult) {
            setMeetingPoint(cachedResult.meetingPoint);
            setAttendeeAddresses(cachedResult.attendeeAddresses);
            setHasInitialMeetingPoint(true);
            return; // No need to calculate if we have cache
        }

        // If no cache, calculate asynchronously
        const calculateAndSetMeetingPoint = async () => {
            const result = await calculateMeetingPoint(currentGroupMembers, memoizedAddresses, () =>
                groupsService.getGroupMemberAddresses(currentGroup.id, user.uid)
            );
            setMeetingPoint(result.meetingPoint);
            setAttendeeAddresses(result.attendeeAddresses);
            setHasInitialMeetingPoint(true);
        };

        calculateAndSetMeetingPoint();
    }, [currentGroup, currentGroupMembers, memoizedAddresses, calculateMeetingPoint, getCachedMeetingPoint, user.uid]);

    // --- Attendance Handlers (no redundant reloads) ---
    const handleAttendanceConfirm = useCallback(async () => {
        if (!currentGroup || !user) return;
        try {
            const defaultAddress = addresses.find(a => a.is_default) || addresses[0];
            const location = defaultAddress ? { lat: defaultAddress.latitude, lng: defaultAddress.longitude } : null;
            const success = await updateMyAttendance(currentGroup.id, true, location);
            if (success) {
                // Reload group and members to get up-to-date attendance
                await Promise.all([
                    loadGroup(currentGroup.id),
                    loadGroupMembers(currentGroup.id)
                ]);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to confirm attendance. Please try again.');
        }
    }, [currentGroup, user, addresses, updateMyAttendance, loadGroup, loadGroupMembers]);

    const handleAttendanceCancel = useCallback(async () => {
        if (!currentGroup || !user) return;
        try {
            const success = await updateMyAttendance(currentGroup.id, false, null);
            if (success) {
                // Reload group and members to get up-to-date attendance
                await Promise.all([
                    loadGroup(currentGroup.id),
                    loadGroupMembers(currentGroup.id)
                ]);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to cancel attendance. Please try again.');
        }
    }, [currentGroup, user, updateMyAttendance, loadGroup, loadGroupMembers]);

    const handleSettingsPress = useCallback(() => {
        if (!currentGroup) return;
        router.push(`/groups/${currentGroup.id}/settings`);
    }, [currentGroup]);

    useEffect(() => {
        return () => {
            if (error) clearError();
        };
    }, [error, clearError]);
    // [REFACTOR END]

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

    // Show loading screen while initial data is being fetched
    if (isLoading || (!hasInitialMeetingPoint && isCalculatingMeetingPoint)) {
        return (
            <View style={styles.container}>
                {/* Background */}
                <View style={styles.backgroundContainer}>
                    <MetroBackground />
                </View>

                <SafeAreaView style={styles.loadingContainer}>
                    <View style={styles.loadingContent}>
                        <LoadingIndicator size="large" />
                        <Text style={styles.loadingTitle}>Loading Group...</Text>
                        <Text style={styles.loadingSubtitle}>
                            {!currentGroup ? "Fetching group details" : 
                             currentGroupMembers.length === 0 ? "Loading members" : 
                             !hasInitialMeetingPoint && isCalculatingMeetingPoint ? "Calculating meeting point" :
                             "Ready"}
                        </Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    if (!currentGroup && !isLoading) {
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
                        {/* Subtle loading indicator for background calculations */}
                        {hasInitialMeetingPoint && isCalculatingMeetingPoint && (
                            <View style={styles.backgroundLoadingContainer}>
                                <LoadingIndicator size="small" />
                                <Text style={styles.backgroundLoadingText}>Updating meeting point...</Text>
                            </View>
                        )}

                        {/* Slide to Confirm */}
                        <View style={styles.slideContainer}>
                            <SlideToConfirm
                                text="I'm attending!"
                                cancelText="I can't make it"
                                onConfirm={handleAttendanceConfirm}
                                onCancel={handleAttendanceCancel}
                                isConfirmed={currentGroupMembers.find(m => m.is_me)?.attendance?.isAttending || false}
                                disabled={isLoading}
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
                    </View>

                    {/* Meeting Point Results with Swipe Functionality - No padding to avoid double padding */}
                    {meetingPoint && (
                        <MeetingPointResults
                            meetingPoint={meetingPoint}
                            meetingPoints={meetingPoint.allMeetingPoints || [meetingPoint]}
                            currentMeetingPointIndex={currentMeetingPointIndex}
                            setCurrentMeetingPointIndex={setCurrentMeetingPointIndex}
                            mode="group"
                            attending={currentGroupMembers.find(m => m.is_me)?.attendance?.isAttending || false}
                            addresses={attendeeAddresses}
                        />
                    )}
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
        marginBottom: 10,
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
        fontSize: 14,
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    loadingContent: {
        alignItems: 'center',
        gap: 16,
    },
    loadingTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
    },
    loadingSubtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 8,
    },
    backgroundLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        marginBottom: 16,
    },
    backgroundLoadingText: {
        fontSize: 14,
        color: '#6b7280',
        marginLeft: 8,
    },
}); 