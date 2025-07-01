import React, { useState, useEffect, useCallback } from 'react';
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
    FlatList,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../lib/contexts/AuthContext';
import { useGroups } from '../../../lib/contexts/GroupsContext';
import SlideToConfirm from '../../../lib/components/utils/SlideToConfirm';
import MapContainer from '../../../lib/components/maps/MapContainer';
import RouteDetails from '../../../lib/components/meeting/RouteDetails';
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

function MapDisplay({ meetingPoint, routes, attendeeAddresses }: {
    meetingPoint: any,
    routes: any[],
    attendeeAddresses: any[]
}) {
    const [mapReady, setMapReady] = useState(false);
    const [mapExpanded, setMapExpanded] = useState(false);

    const handleMapReady = () => {
        setMapReady(true);
    };

    const toggleMapExpanded = () => {
        setMapExpanded(!mapExpanded);
    };

    // Create markers for the map
    const markers = React.useMemo(() => {
        const allMarkers = [];

        // Add attendee markers
        attendeeAddresses.forEach((addr, index) => {
            if (addr.lat && addr.lng) {
                allMarkers.push({
                    position: [addr.lng, addr.lat],
                    title: addr.name || `Attendee ${index + 1}`,
                    type: 'location',
                    number: index + 1
                });
            }
        });

        // Add meeting point marker
        if (meetingPoint && meetingPoint.coordinates) {
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
        <View style={[styles.mapContainer, { height: mapExpanded ? 320 : 200 }]}>
            {/* Map Controls */}
            <View style={styles.mapControls}>
                <TouchableOpacity
                    style={styles.mapExpandButton}
                    onPress={toggleMapExpanded}
                >
                    <MaterialIcons 
                        name={mapExpanded ? "fullscreen-exit" : "fullscreen"} 
                        size={16} 
                        color="#6b7280" 
                    />
                </TouchableOpacity>
            </View>

            <MapContainer
                center={meetingPoint ? meetingPoint.coordinates : [2.3522, 48.8566]}
                markers={markers}
                routes={routes}
                onMapReady={handleMapReady}
                height="100%"
                zoomToFitMarkers={mapReady}
            />
        </View>
    );
}

function MeetingPointResults({
    meetingPoint,
    currentMeetingPointIndex,
    setCurrentMeetingPointIndex
}: {
    meetingPoint: any,
    currentMeetingPointIndex: number,
    setCurrentMeetingPointIndex: (index: number) => void
}) {
    if (!meetingPoint) return null;

    const [showRouteDetails, setShowRouteDetails] = useState(false);

    // Group routes by address if we have a single meeting point with multiple routes
    const meetingPoints = (() => {
        if (meetingPoint.allMeetingPoints) {
            return meetingPoint.allMeetingPoints;
        }
        
        // If single meeting point with multiple routes, create separate points for each address
        if (meetingPoint.routes && meetingPoint.travelTimes && meetingPoint.travelTimes.length > 1) {
            const routesPerAddress = Math.ceil(meetingPoint.routes.length / meetingPoint.travelTimes.length);
            
            return meetingPoint.travelTimes.map((travelTime: any, index: number) => {
                const startIndex = index * routesPerAddress;
                const endIndex = Math.min(startIndex + routesPerAddress, meetingPoint.routes.length);
                const addressRoutes = meetingPoint.routes.slice(startIndex, endIndex);
                
                return {
                    name: `${meetingPoint.name} (via ${travelTime.address})`,
                    coordinates: meetingPoint.coordinates,
                    routes: addressRoutes,
                    travelTimes: [travelTime],
                    venues: meetingPoint.venues || []
                };
            });
        }
        
        return [meetingPoint];
    })();
    const currentMP = meetingPoints[currentMeetingPointIndex] || meetingPoint;

    // Calculate statistics for current meeting point
    const stats = React.useMemo(() => {
        if (!currentMP.travelTimes?.length && !currentMP.travel_times?.length) return null;

        const travelTimes = currentMP.travelTimes || currentMP.travel_times || [];
        const durations = travelTimes.map(tt => tt.duration || 0);
        const distances = travelTimes.map(tt => tt.distance || 0);

        return {
            avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
            maxDuration: Math.max(...durations),
            totalDistance: distances.reduce((a, b) => a + b, 0),
            attendeeCount: durations.length
        };
    }, [currentMP]);

    const handleShareLocation = async () => {
        try {
            const coords = currentMP.coordinates;
            const shareData = {
                title: `Meeting Point: ${currentMP.name}`,
                message: `Let's meet at ${currentMP.name}\nhttps://maps.google.com/?q=${coords[1]},${coords[0]}`,
            };

            await Share.share(shareData);
        } catch (error) {
            console.error('Error sharing:', error);
            Alert.alert('Error', 'Failed to share location');
        }
    };

    const handleOpenInMaps = () => {
        const [lng, lat] = currentMP.coordinates;
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}&ll=${lat},${lng}&z=16`;

        if (Platform.OS === 'ios') {
            // Try to open in Apple Maps first, fallback to Google Maps
            const appleMapsUrl = `http://maps.apple.com/?q=${lat},${lng}&ll=${lat},${lng}&z=16`;
            Linking.canOpenURL(appleMapsUrl).then(supported => {
                if (supported) {
                    Linking.openURL(appleMapsUrl);
                } else {
                    Linking.openURL(mapsUrl);
                }
            });
        } else {
            Linking.openURL(mapsUrl);
        }
    };

    const renderMeetingPoint = ({ item, index }: { item: any, index: number }) => (
        <View style={styles.meetingPointSlide}>
            <View style={styles.meetingPointContent}>
                <Text style={styles.locationName}>{item.name}</Text>
                
                {/* Statistics for current meeting point */}
                {stats && (
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.avgDuration} min</Text>
                            <Text style={styles.statLabel}>Avg Travel</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.maxDuration} min</Text>
                            <Text style={styles.statLabel}>Max Travel</Text>
                        </View>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleOpenInMaps}>
                        <MaterialIcons name="map" size={18} color="#6366f1" />
                        <Text style={styles.actionButtonText}>Open in Maps</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionButton} onPress={handleShareLocation}>
                        <MaterialIcons name="share" size={18} color="#6366f1" />
                        <Text style={styles.actionButtonText}>Share Location</Text>
                    </TouchableOpacity>
                </View>

                {/* Route Details Toggle */}
                {item.routes && item.routes.length > 0 && (
                    <TouchableOpacity 
                        style={styles.routeToggle} 
                        onPress={() => setShowRouteDetails(!showRouteDetails)}
                    >
                        <View style={styles.routeToggleLeft}>
                            <MaterialIcons name="directions" size={20} color="#6366f1" />
                            <Text style={styles.routeToggleText}>
                                Route Details ({item.routes.length} route{item.routes.length !== 1 ? 's' : ''})
                            </Text>
                        </View>
                        <MaterialIcons 
                            name={showRouteDetails ? "expand-less" : "expand-more"} 
                            size={24} 
                            color="#6366f1" 
                        />
                    </TouchableOpacity>
                )}

                {/* Collapsible Route Details */}
                {showRouteDetails && (
                    <View style={styles.routeDetailsContainer}>
                        {/* Debugging removed to reduce noise */}
                        <RouteDetails 
                            routes={item.routes || []} 
                            travelTimes={item.travelTimes || item.travel_times || []} 
                        />
                    </View>
                )}

                {/* Venues */}
                {item.venues && item.venues.length > 0 && (
                    <View style={styles.venuesSection}>
                        <Text style={styles.venuesTitle}>Nearby Places</Text>
                        <View style={styles.venuesGrid}>
                            {item.venues.slice(0, 3).map((venue, venueIndex) => (
                                <View key={venueIndex} style={styles.venueChip}>
                                    <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Fallback notice */}
                {item.name === "Geographic Center" && (
                    <View style={styles.fallbackNotice}>
                        <MaterialIcons name="info" size={16} color="#f59e0b" />
                        <Text style={styles.fallbackText}>Estimated location</Text>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <>
            {meetingPoints.length > 1 ? (
                // Full-width swipeable area that breaks out of containers
                <View style={styles.swipeableContainer}>
                    {/* Pagination dots */}
                    <View style={styles.paginationContainer}>
                        {meetingPoints.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.paginationDot,
                                    index === currentMeetingPointIndex && styles.paginationDotActive
                                ]}
                            />
                        ))}
                    </View>

                    <FlatList
                        data={meetingPoints.length > 1 ? [...meetingPoints, ...meetingPoints, ...meetingPoints] : meetingPoints}
                        renderItem={({ item, index }) => renderMeetingPoint({ item, index: index % meetingPoints.length })}
                        keyExtractor={(item, index) => `meeting-point-${index}-${index % meetingPoints.length}`}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={meetingPoints.length > 1 ? meetingPoints.length + currentMeetingPointIndex : currentMeetingPointIndex}
                        getItemLayout={(data, index) => ({
                            length: screenWidth,
                            offset: screenWidth * index,
                            index,
                        })}
                        onMomentumScrollEnd={(event) => {
                            if (meetingPoints.length <= 1) return;
                            
                            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                            const actualIndex = index % meetingPoints.length;
                            setCurrentMeetingPointIndex(actualIndex);
                            
                            // Reset to middle section if we're at the edges
                            setTimeout(() => {
                                if (index < meetingPoints.length || index >= meetingPoints.length * 2) {
                                    const ref = event.target;
                                    if (ref && ref.scrollToIndex) {
                                        ref.scrollToIndex({
                                            index: meetingPoints.length + actualIndex,
                                            animated: false
                                        });
                                    }
                                }
                            }, 100);
                        }}
                        style={styles.meetingPointsList}
                        snapToAlignment="start"
                        decelerationRate="fast"
                        snapToInterval={screenWidth}
                        contentContainerStyle={{ paddingHorizontal: 0 }}
                    />
                </View>
            ) : (
                // Single meeting point stays in a container
                <View style={styles.resultsContainer}>
                    <View style={styles.singleMeetingPointContainer}>
                        {renderMeetingPoint({ item: currentMP, index: 0 })}
                    </View>
                </View>
            )}
        </>
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

            console.log('🎯 Meeting point API result:', {
                hasResult: !!result,
                routesCount: result?.routes?.length || 0,
                allMeetingPointsCount: result?.allMeetingPoints?.length || 0,
                travelTimesCount: result?.travelTimes?.length || 0,
                sampleRoutes: result?.routes?.slice(0, 2),
                resultKeys: result ? Object.keys(result) : []
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
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.groupTitle} numberOfLines={1}>
                        {currentGroup?.name || 'Loading...'}
                    </Text>

                </View>
                <TouchableOpacity onPress={handleSettingsPress}>
                    <MaterialIcons name="settings" size={24} color="#6b7280" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Map Display */}
                <MapDisplay
                    meetingPoint={meetingPoint ? (meetingPoint.allMeetingPoints?.[currentMeetingPointIndex] || meetingPoint) : null}
                    routes={meetingPoint ? (meetingPoint.allMeetingPoints?.[currentMeetingPointIndex]?.routes || meetingPoint.routes || []) : []}
                    attendeeAddresses={attendeeAddresses}
                />

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
                    <>
                        {/* Main results rendering debug removed to reduce noise */}
                        <MeetingPointResults
                            meetingPoint={meetingPoint}
                            currentMeetingPointIndex={currentMeetingPointIndex}
                            setCurrentMeetingPointIndex={setCurrentMeetingPointIndex}
                        />
                    </>
                )}

                {/* Attendees List */}
                <AttendeesList
                    members={currentGroupMembers}
                    isExpanded={attendeesExpanded}
                    onToggle={() => setAttendeesExpanded(!attendeesExpanded)}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    headerCenter: {
        flex: 1,
        paddingHorizontal: 16,
    },
    groupTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
    },
    groupSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 2,
    },
    content: {
        flex: 1,
    },
    mapContainer: {
        marginHorizontal: 16,
        marginVertical: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#f9fafb',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        marginBottom: 16,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        margin: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        gap: 12,
    },
    loadingText: {
        fontSize: 16,
        color: '#6366f1',
        fontWeight: '500',
    },
    needMoreContainer: {
        alignItems: 'center',
        padding: 24,
        margin: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    needMoreTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
        marginBottom: 8,
    },
    needMoreText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    resultsContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        margin: 16,
        marginTop: 8,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    attendeesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    attendeesHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    attendeesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    attendeesList: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    attendeeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
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
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
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
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6366f1',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#cbd5e1',
        marginHorizontal: 8,
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f4ff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#c7d2fe',
        gap: 8,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366f1',
    },
    routeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    routeToggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    routeDetailsContainer: {
        marginTop: 8,
    },
    meetingPointsList: {
        marginHorizontal: 0,
    },

    meetingPointSlide: {
        width: screenWidth,
        paddingHorizontal: 16,
    },
    meetingPointContent: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 8,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#d1d5db',
    },
    paginationDotActive: {
        backgroundColor: '#6366f1',
        width: 24,
    },
    swipeHint: {
        fontSize: 12,
        color: '#6b7280',
        fontStyle: 'italic',
    },
    mapControls: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
    },
    mapExpandButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    singleMeetingPointContainer: {
        // No additional styling needed, will inherit from resultsContainer
    },
}); 