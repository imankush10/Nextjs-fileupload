"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";

// Define types for the image data
interface ImageData {
  id: number;
  created_at: string;
  file_name: string;
  file_size: number;
  url: string;
  storage_path: string;
}

// Type assertion for environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PhotoGallery(): JSX.Element {
  const [images, setImages] = useState<ImageData[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch images on component mount
  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async (): Promise<void> => {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching images:", error);
      return;
    }

    setImages(data || []);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) return;

    try {
      setUploading(true);

      const { data, error } = await supabase.storage
        .from('photos')
        .upload(`${Date.now()}-${selectedFile.name}`, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedFile.type,
          duplex: 'half',
          metadata: {
            size: selectedFile.size.toString(),
            filename: selectedFile.name
          }
        });

      if (error) throw error;

      await fetchImages();
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, path: string): Promise<void> => {
    try {
      const { error: storageError } = await supabase.storage
        .from("photos")
        .remove([path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("images")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      await fetchImages();
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="w-full"
            />
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
        {images.map((image) => (
          <div key={image.id} className="break-inside-avoid mb-4">
            <Card className="overflow-hidden">
              <img
                src={`${supabaseUrl}${image.url}`}
                alt={image.file_name}
                className="w-full h-auto object-cover"
              />
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium truncate" title={image.file_name}>
                      {image.file_name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {Math.round(image.file_size / 1024)} KB • {" "}
                      {formatDistanceToNow(new Date(image.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(image.id, image.storage_path)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}