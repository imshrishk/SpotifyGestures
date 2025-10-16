import axios from 'axios';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export class SpotifyApi {
  private static baseUrl = 'https://api.spotify.com/v1';

  static async getCurrentTrack(token: string) {
    const response = await fetch(`${this.baseUrl}/me/player/currently-playing`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 204) {
      return null; // No active playback
    }
    
    return response.json();
  }

  static async pausePlayback(token: string) {
    await fetch(`${this.baseUrl}/me/player/pause`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async resumePlayback(token: string) {
    await fetch(`${this.baseUrl}/me/player/play`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async skipToNext(token: string) {
    await fetch(`${this.baseUrl}/me/player/next`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async skipToPrevious(token: string) {
    await fetch(`${this.baseUrl}/me/player/previous`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async setVolume(token: string, volume: number) {
    await fetch(`${this.baseUrl}/me/player/volume?volume_percent=${volume}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async getQueue(token: string) {
    const response = await fetch(`${this.baseUrl}/me/player/queue`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.json();
  }

  static async toggleShuffle(token: string, state: boolean) {
    await fetch(`${this.baseUrl}/me/player/shuffle?state=${state}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async setRepeatMode(token: string, state: 'off' | 'context' | 'track') {
    await fetch(`${this.baseUrl}/me/player/repeat?state=${state}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async seekToPosition(token: string, position_ms: number) {
    await fetch(`${this.baseUrl}/me/player/seek?position_ms=${position_ms}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  static async getUserPlaylists(token: string) {
    const response = await axios.get(`${SPOTIFY_API_BASE}/me/playlists`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  static async getPlaylistTracks(token: string, playlistId: string) {
    console.log(`Fetching tracks for playlist: ${playlistId}`);
    // Fetch all tracks using pagination
    let allTracks: any[] = [];
    let nextUrl = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=100`;
    let pageCount = 0;
    
    try {
      while (nextUrl) {
        pageCount++;
        console.log(`Fetching playlist tracks page ${pageCount}: ${nextUrl}`);
        
        const response = await axios.get(nextUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Add current page of tracks to our collection
        if (response.data.items && response.data.items.length > 0) {
          console.log(`Got ${response.data.items.length} tracks from page ${pageCount}`);
          allTracks = [...allTracks, ...response.data.items];
        } else {
          console.log(`No tracks found on page ${pageCount}`);
        }
        
        // Check if there's another page of results
        nextUrl = response.data.next;
      }
      
      console.log(`Finished fetching ${allTracks.length} total tracks for playlist ${playlistId}`);
      
      // Return data structure that matches what components expect
      return {
        items: allTracks,
        total: allTracks.length
      };
    } catch (error) {
      console.error('Error fetching playlist tracks:', error);
      throw error;
    }
  }

  static async playContext(token: string, contextUri: string, offset: number = 0) {
    console.log(`Playing context with URI: ${contextUri}, offset position: ${offset}`);
    
    try {
      // Device activation logic
      const deviceResponse = await fetch(`${this.baseUrl}/me/player/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!deviceResponse.ok) {
        console.error("Failed to fetch devices:", deviceResponse.status, await deviceResponse.text());
        // Potentially throw an error here or attempt to play without a device ID
      }

      const deviceData = await deviceResponse.json();
      const activeDevice = deviceData.devices.find((device: any) => device.is_active);
      let deviceIdToUse = activeDevice?.id;

      if (!activeDevice && deviceData.devices && deviceData.devices.length > 0) {
        console.log('No active Spotify device found. Attempting to activate the first available device.');
        const firstDevice = deviceData.devices[0];
        deviceIdToUse = firstDevice.id;
        
        try {
          const transferResponse = await fetch(`${this.baseUrl}/me/player`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ device_ids: [firstDevice.id], play: false }) // Set play: false initially
          });

          if (!transferResponse.ok) {
            console.error("Failed to transfer playback to device:", transferResponse.status, await transferResponse.text());
            // If transfer fails, clear deviceIdToUse so we don't try to use a device that couldn't be activated
            deviceIdToUse = undefined; 
          } else {
            // Wait a moment for transfer to complete
            console.log(`Transferring playback to ${firstDevice.name}, please wait...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay for transfer
            console.log(`Playback transferred to ${firstDevice.name}. Now attempting to play context.`);
          }
        } catch (transferError) {
          console.error('Error during playback transfer attempt:', transferError);
          deviceIdToUse = undefined; // Clear on error
        }
      } else if (!deviceData.devices || deviceData.devices.length === 0) {
        console.log("No Spotify devices found available at all.");
        // No devices available, play will likely fail without a device_id or active device.
      } else if (activeDevice) {
        console.log(`Using active device: ${activeDevice.name}`);
      }
      
      const requestBody: any = {
        context_uri: contextUri,
      };
      
      // Spotify API: offset is an object { "position": number } or { "uri": string }
      // If offset is 0 or more, set it. If undefined or negative, Spotify defaults to start.
      if (typeof offset === 'number' && offset >= 0) {
        requestBody.offset = { position: offset };
      }
      
      if (deviceIdToUse) {
        requestBody.device_id = deviceIdToUse;
        console.log('Attempting to play on device_id:', deviceIdToUse);
      } else {
        console.log('No specific device ID to use. Spotify will attempt to play on the default/active device if any.');
      }
      
      console.log('Play context request body:', JSON.stringify(requestBody));
      
      const response = await fetch(`${this.baseUrl}/me/player/play`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to play context: ${response.status}`, errorText);
        
        // Try an alternative approach
        console.log('Trying alternative play context method...');
        
        // Extract the playlist ID from the URI
        const playlistId = contextUri.split(':').pop();
        if (playlistId) {
          // Get the playlist tracks
          const tracksResponse = await fetch(`${this.baseUrl}/playlists/${playlistId}/tracks`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (tracksResponse.ok) {
            const tracksData = await tracksResponse.json();
            
            if (tracksData.items && tracksData.items.length > 0) {
              console.log(`Retrieved ${tracksData.items.length} tracks from playlist`);
              
              // Get the URIs for the next few tracks starting from our offset
              const startIndex = Math.min(offset, tracksData.items.length - 1);
              const trackUris = tracksData.items
                .slice(startIndex, startIndex + 10) // Get next 10 tracks
                .filter((item: any) => item.track && item.track.uri)
                .map((item: any) => item.track.uri);
              
              if (trackUris.length > 0) {
                console.log(`Playing ${trackUris.length} tracks from position ${startIndex}`);
                
                // Play the tracks in sequence
                await fetch(`${this.baseUrl}/me/player/play`, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    uris: trackUris
                  })
                });
              }
            }
          }
        }
      } else {
        console.log("Successfully started context playback");
      }
    } catch (error) {
      console.error("Error in playContext:", error);
    }
  }

  static async playTrack(token: string, uri: string) {
    await fetch(`${this.baseUrl}/me/player/play`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        uris: [uri]
      })
    });
  }

  static async playSmartly(token: string, uri: string, contextUri?: string) {
    try {
      // 1. Get active device
      const deviceResponse = await fetch(`${this.baseUrl}/me/player/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const deviceData = await deviceResponse.json();
      let activeDevice = deviceData.devices.find((device: any) => device.is_active);
      if (!activeDevice && deviceData.devices.length > 0) {
        // If no device is active, pick the first available
        activeDevice = deviceData.devices[0];
        // Transfer playback to this device
        await fetch(`${this.baseUrl}/me/player`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [activeDevice.id], play: false })
        });
        // Wait a moment for transfer
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (contextUri) {
        // 2. Try context_uri + offset by URI
        let playRes = await fetch(`${this.baseUrl}/me/player/play`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            context_uri: contextUri,
            offset: { uri },
            device_id: activeDevice?.id
          })
        });
        if (playRes.ok) return;

        // 3. If that fails, fallback to offset by position
        // Get playlist tracks
        const playlistId = contextUri.split(':').pop();
        const tracksResponse = await fetch(`${this.baseUrl}/playlists/${playlistId}/tracks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (tracksResponse.ok) {
          const tracksData = await tracksResponse.json();
          const trackIndex = tracksData.items.findIndex((item: any) => item.track && item.track.uri === uri);
          if (trackIndex !== -1) {
            playRes = await fetch(`${this.baseUrl}/me/player/play`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                context_uri: contextUri,
                offset: { position: trackIndex },
                device_id: activeDevice?.id
              })
            });
            if (playRes.ok) return;
          }
        }
        // 4. If all else fails, try transferring playback again and retry
        await fetch(`${this.baseUrl}/me/player`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [activeDevice?.id], play: false })
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Retry context_uri + offset by URI
        playRes = await fetch(`${this.baseUrl}/me/player/play`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            context_uri: contextUri,
            offset: { uri },
            device_id: activeDevice?.id
          })
        });
        if (playRes.ok) return;
      }
      // 5. Fallback: play single track only
      await this.playTrack(token, uri);
    } catch (error) {
      console.error('Error in playSmartly:', error);
      await this.playTrack(token, uri);
    }
  }

  static async getRecommendations(token: string) {
    const response = await axios.get(`${SPOTIFY_API_BASE}/recommendations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  static async getRecentlyPlayed(token: string) {
    const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/recently-played`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  static async getLyrics(token: string, trackId: string) {
    // Note: This is a mock implementation since Spotify's lyrics API is not publicly available
    // In a real implementation, you would need to use a third-party lyrics service
    return {
      lines: [
        { text: "Sample lyrics line 1", time: 0 },
        { text: "Sample lyrics line 2", time: 3000 },
        { text: "Sample lyrics line 3", time: 6000 }
      ]
    };
  }
} 