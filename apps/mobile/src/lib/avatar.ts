import { AVATAR_BUCKET, AVATAR_SIZE, AVATAR_URL_SECONDS, avatarPath } from '@gymos/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { profileKey, useProfile } from '@/lib/profile';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Profile photos live in a private bucket; profiles.avatar_url is the storage
// path. A signed URL is fetched per path (cached ~an hour), and <Avatar />
// caches the image by path, so a fresh URL doesn't mean a fresh download.
export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['avatar-url', path],
    enabled: !!path,
    staleTime: (AVATAR_URL_SECONDS - 10 * 60) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path!, AVATAR_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

// The signed-in user's own photo: path and URL.
export function useMyAvatar() {
  const profile = useProfile();
  const path = profile.data?.avatar_url ?? null;
  const url = useAvatarUrl(path);
  return { path, url: url.data ?? null };
}

export type PhotoSource = 'camera' | 'library';

// Opens the camera or gallery (square crop where the phone offers it).
// Resolves null when cancelled; throws when camera access is refused.
async function pickPhoto(source: PhotoSource) {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera access in your phone settings to take a photo.');
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0];
}

// Middle square, AVATAR_SIZE px, JPEG: about 40 KB on mobile data.
async function toSquareJpeg(asset: ImagePicker.ImagePickerAsset) {
  const side = Math.min(asset.width, asset.height);
  const image = await ImageManipulator.manipulate(asset.uri)
    .crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side })
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return Uint8Array.from(atob(saved.base64!), (c) => c.charCodeAt(0));
}

// Take or choose a photo and save it, or remove it (source null).
// Resolves false when the person cancelled the picker.
export function useSetAvatar() {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const { path: old } = useMyAvatar();

  return useMutation({
    mutationFn: async (source: PhotoSource | null) => {
      let path: string | null = null;
      if (source) {
        const asset = await pickPhoto(source);
        if (!asset) return false;
        path = avatarPath(userId!);
        const { error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, await toSquareJpeg(asset), { contentType: 'image/jpeg' });
        if (error) throw error;
      }
      const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', userId!);
      if (error) {
        if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);
        throw error;
      }
      if (old) await supabase.storage.from(AVATAR_BUCKET).remove([old]);
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
  });
}
