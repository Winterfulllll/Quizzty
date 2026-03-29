import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  onModuleInit() {
    const url = process.env.CLOUDINARY_URL;

    if (url) {
      const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url);

      if (match) {
        cloudinary.config({
          api_key: match[1],
          api_secret: match[2],
          cloud_name: match[3],
        });
      }
    }
  }

  async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result?: UploadApiResponse) => {
            if (error || !result) {
              reject(new BadRequestException('Ошибка загрузки изображения'));

              return;
            }

            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        )
        .end(file.buffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
