import { Platform, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import {
  Center,
  ScrollView,
  VStack,
  Skeleton,
  Text,
  Heading,
  KeyboardAvoidingView,
  useToast,
} from 'native-base';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { ScreenHeader } from '@components/ScreenHeader';
import { UserPhoto } from '@components/UserPhoto';
import { Input } from '@components/Input';
import { Button } from '@components/Button';
import { useAuth } from '@hooks/useAuth';
import { api } from '@services/api';
import { AppError } from '@utils/AppError';
import defaultUserPhotoImg from '@assets/userPhotoDefault.png';

type FormDataProps = {
  name: string;
  email: string;
  old_password: string;
  password: string;
  confirm_password: string;
};

const profileSchema = yup.object({
  name: yup.string().required('Informe o nome.'),
  password: yup
    .string()
    .min(6, 'A nova senha deve ter pelo menos 6 dígitos.')
    .nullable()
    .transform((value) => (!!value ? value : null)),
  confirm_password: yup
    .string()
    .nullable()
    .transform((value) => (!!value ? value : null))
    .oneOf([yup.ref('password')], 'A confirmação da nova senha não confere.')
    .when('password', {
      is: (Field: any) => Field,
      then: (schema) =>
        schema
          .nullable()
          .required('Informe a confirmação da senha.')
          .transform((value) => (!!value ? value : null)),
    }),
});

const PHOTO_SIZE = 33;

export function Profile() {
  const { user, updateUserProfile } = useAuth();
  const toast = useToast();

  const [isUpdating, setIsUpdating] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormDataProps>({
    defaultValues: {
      name: user.name,
      email: user.email,
    },
    resolver: yupResolver(profileSchema),
  });

  const [photoIsLoading, setPhotoIsLoading] = useState(false);

  async function handleUserPhotoSelect() {
    setPhotoIsLoading(true);
    try {
      const photoSelected = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        aspect: [4, 4],
        allowsEditing: true,
      });

      if (photoSelected.canceled) return;

      if (photoSelected.assets[0].uri) {
        const photoInfo = (await FileSystem.getInfoAsync(
          photoSelected.assets[0].uri
        )) as FileSystem.FileInfo & { size?: number };

        if (photoInfo.size && photoInfo.size / 1024 / 1024 > 5) {
          return toast.show({
            title: 'Essa Imagem é muito grande. Escolha uma de até 5MB',
            placement: 'top',
            bgColor: 'red.500',
          });
        }

        const fileExtension = photoSelected.assets[0].uri.split('.').pop();

        const photoFile = {
          name: `${user.name}.${fileExtension}`.toLowerCase(),
          uri: photoSelected.assets[0].uri,
          type: `${photoSelected.assets[0].type}/${fileExtension}`,
        } as any;

        const userPhotoUploadForm = new FormData();
        userPhotoUploadForm.append('avatar', photoFile);

        const avatarUpdatedResponse = await api.patch(
          '/users/avatar',
          userPhotoUploadForm,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        const userUpdated = user;
        userUpdated.avatar = avatarUpdatedResponse.data.avatar;
        await updateUserProfile(userUpdated);

        console.log('Profile userUpdated =>', userUpdated);

        toast.show({
          title: 'Foto atualizada!',
          placement: 'top',
          bgColor: 'green.500',
        });
      }
    } catch (error) {
      const isAppError = error instanceof AppError;
      const title = isAppError
        ? error.message
        : 'Não foi possível atualizar a foto. Tente novamente mais tarde.';

      toast.show({
        title,
        placement: 'top',
        bgColor: 'red.500',
      });
    } finally {
      setPhotoIsLoading(false);
    }
  }

  async function handleProfileUpdate(data: FormDataProps) {
    try {
      setIsUpdating(true);
      const userUpdated = user;
      userUpdated.name = data.name;

      await api.put('/users', data);

      await updateUserProfile(userUpdated);

      toast.show({
        title: 'Perfil atualizado com sucesso!',
        placement: 'top',
        bgColor: 'green.500',
      });
    } catch (error) {
      const isAppError = error instanceof AppError;
      const title = isAppError
        ? error.message
        : 'Não foi possível atualizar os dados. Tente novamente mais tarde.';

      toast.show({
        title,
        placement: 'top',
        bgColor: 'red.500',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <VStack flex={1}>
        <ScreenHeader title='Perfil' />

        <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
          <Center mt={6} px={10}>
            {photoIsLoading ? (
              <Skeleton
                w={PHOTO_SIZE}
                h={PHOTO_SIZE}
                rounded='full'
                startColor='gray.500'
                endColor='gray.400'
              />
            ) : (
              <UserPhoto
                source={
                  user.avatar
                    ? { uri: `${api.defaults.baseURL}/avatar/${user.avatar}` }
                    : defaultUserPhotoImg
                }
                alt='Foto do usuário'
                size={PHOTO_SIZE}
              />
            )}

            <TouchableOpacity onPress={handleUserPhotoSelect}>
              <Text
                color='green.500'
                fontWeight='bold'
                fontSize='md'
                mt={2}
                mb={8}
              >
                Alterar foto
              </Text>
            </TouchableOpacity>

            <Controller
              control={control}
              name='name'
              render={({ field: { onChange, value } }) => (
                <Input
                  placeholder='nome'
                  value={value}
                  onChangeText={onChange}
                  bg='gray.600'
                  errorMessage={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name='email'
              render={({ field: { onChange, value } }) => (
                <Input
                  placeholder='E-mail'
                  value={value}
                  onChangeText={onChange}
                  bg='gray.600'
                  isDisabled
                />
              )}
            />

            <Heading
              color='gray.200'
              fontSize='md'
              mb={2}
              alignSelf='flex-start'
              mt={12}
              fontFamily='heading'
            >
              Alterar senha
            </Heading>

            <Controller
              control={control}
              name='old_password'
              render={({ field: { onChange } }) => (
                <Input
                  placeholder='Senha antiga'
                  secureTextEntry
                  onChangeText={onChange}
                  bg='gray.600'
                />
              )}
            />

            <Controller
              control={control}
              name='password'
              render={({ field: { onChange } }) => (
                <Input
                  placeholder='Nova senha'
                  secureTextEntry
                  onChangeText={onChange}
                  bg='gray.600'
                  errorMessage={errors.password?.message}
                />
              )}
            />

            <Controller
              control={control}
              name='confirm_password'
              render={({ field: { onChange } }) => (
                <Input
                  placeholder='Confirme a nova senha'
                  secureTextEntry
                  onChangeText={onChange}
                  returnKeyType='send'
                  bg='gray.600'
                  errorMessage={errors.confirm_password?.message}
                />
              )}
            />

            <Button
              title='Atualizar'
              mt={4}
              onPress={handleSubmit(handleProfileUpdate)}
              isLoading={isUpdating}
            />
          </Center>
        </ScrollView>
      </VStack>
    </KeyboardAvoidingView>
  );
}
