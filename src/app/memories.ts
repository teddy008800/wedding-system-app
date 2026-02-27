import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../environments/environment';

declare const supabase: {
  createClient: (url: string, key: string, options?: any) => any;
};

interface GuestMemoryRow {
  id: string;
  wedding_id: string;
  guest_name: string;
  caption: string | null;
  media_type: 'image' | 'video';
  file_extension?: string | null;
  mime_type?: string | null;
  drive_direct_url: string;
  drive_view_url: string;
  created_at: string;
  status: string;
}

@Component({
  selector: 'app-memories',
  templateUrl: './memories.html',
  styleUrl: './memories.css',
  standalone: false
})
export class MemoriesComponent implements OnInit {
  protected slug = '';
  protected weddingLabel = 'Our Memories';
  protected weddingDate = '';
  protected rows: GuestMemoryRow[] = [];
  protected actionLoading = false;
  protected actionLoadingText = 'Processing...';
  protected uploadPopup = '';
  protected previewModal = {
    open: false,
    type: '' as 'image' | 'video' | '',
    url: '' as string | SafeResourceUrl
  };
  protected uploadForm = {
    caption: '',
    files: [] as File[]
  };
  protected isDragOver = false;

  private supabaseClient: any | null = null;
  private readonly supabaseUrl = environment.supabase.url;
  private readonly supabaseAnonKey = environment.supabase.anonKey;
  private currentWeddingId: string | null = null;
  private popupTimer: number | null = null;
  private readonly allowedImageExtensions = new Set([
    'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif', 'tif', 'tiff', 'avif'
  ]);
  private readonly allowedVideoExtensions = new Set([
    'mp4', 'mov', 'm4v', 'webm', 'ogg', 'ogv', 'avi', 'mkv'
  ]);

  constructor(private route: ActivatedRoute, private router: Router, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    if (this.supabaseUrl.startsWith('http') && this.supabaseAnonKey.length > 20 && typeof supabase !== 'undefined') {
      this.supabaseClient = supabase.createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    }

    this.route.paramMap.subscribe((params) => {
      this.slug = String(params.get('slug') ?? '').trim();
      if (!this.slug) {
        void this.router.navigate(['/']);
        return;
      }
      void this.loadWeddingAndMemories();
    });
  }

  protected handleFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadForm.files = input.files ? Array.from(input.files) : [];
  }

  protected openPicker(input: HTMLInputElement): void {
    input.click();
  }

  protected handleDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  protected handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  protected handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    this.uploadForm.files = files ? Array.from(files) : [];
  }

  protected async submitMemory(): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    if (!this.currentWeddingId) {
      this.showPopup('Wedding data not found.');
      return;
    }
    if (!this.uploadForm.files.length) {
      this.showPopup('Please select at least one file.');
      return;
    }

    await this.runWithLock('Uploading memory...', async () => {
      if (!this.supabaseClient) {
        this.showPopup('Data service unavailable.');
        return;
      }

      for (let index = 0; index < this.uploadForm.files.length; index += 1) {
        const file = this.uploadForm.files[index];
        const ext = this.getFileExtension(file.name);
        const mime = String(file.type || '').toLowerCase();
        const isImage = mime.startsWith('image/') || this.allowedImageExtensions.has(ext);
        const isVideo = mime.startsWith('video/') || this.allowedVideoExtensions.has(ext);
        if (!isImage && !isVideo) {
          this.showPopup(`Unsupported file type: ${file.name}`);
          return;
        }

        this.actionLoadingText = `Uploading ${index + 1}/${this.uploadForm.files.length}...`;
        const base64Data = await this.fileToBase64(file);
        const response = await fetch('/api/google/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `${Date.now()}-${file.name}`,
            mimeType: file.type,
            base64Data
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          this.showPopup(payload?.error || 'Upload to Google Drive failed.');
          return;
        }

        const mediaType = isVideo ? 'video' : 'image';
        const { error } = await this.supabaseClient.from('guest_memories').insert({
          wedding_id: this.currentWeddingId,
          guest_name: 'Guest',
          caption: this.uploadForm.caption.trim() || null,
          media_type: mediaType,
          file_extension: ext || null,
          drive_file_id: payload.fileId,
          drive_view_url: payload.webViewLink,
          drive_direct_url: payload.directUrl,
          mime_type: file.type,
          status: 'approved',
          created_at: new Date().toISOString()
        });

        if (error) {
          this.showPopup('Upload saved to Drive but failed to save metadata.');
          return;
        }
      }

      this.uploadForm = { caption: '', files: [] };
      this.showPopup('Memory uploaded successfully.');
      await this.loadMemories();
    });
  }

  private async loadWeddingAndMemories(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data } = await this.supabaseClient
      .from('weddings')
      .select('id, groom, bride, wedding_date')
      .eq('slug', this.slug)
      .limit(1)
      .maybeSingle();

    if (!data?.id) {
      this.currentWeddingId = null;
      this.rows = [];
      this.weddingLabel = 'Our Memories';
      this.weddingDate = '';
      return;
    }

    this.currentWeddingId = data.id;
    this.weddingLabel = `${data.groom || ''} & ${data.bride || ''}`.trim() || 'Our Memories';
    this.weddingDate = data.wedding_date
      ? new Date(`${data.wedding_date}T00:00:00`).toLocaleDateString('en-MY', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        })
      : '';

    await this.loadMemories();
  }

  private async loadMemories(): Promise<void> {
    if (!this.supabaseClient || !this.currentWeddingId) {
      this.rows = [];
      return;
    }

    const { data, error } = await this.supabaseClient
      .from('guest_memories')
      .select('*')
      .eq('wedding_id', this.currentWeddingId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    this.rows = error ? [] : (data ?? []);
  }

  private showPopup(message: string): void {
    this.uploadPopup = message;
    if (this.popupTimer) {
      window.clearTimeout(this.popupTimer);
    }
    this.popupTimer = window.setTimeout(() => {
      this.uploadPopup = '';
    }, 2600);
  }

  protected openPreview(type: 'image' | 'video', url: string): void {
    this.previewModal = {
      open: true,
      type,
      url: type === 'video' ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : url
    };
  }

  protected closePreview(): void {
    this.previewModal = {
      open: false,
      type: '',
      url: ''
    };
  }

  protected isImageRow(row: GuestMemoryRow): boolean {
    const mediaType = String(row.media_type || '').toLowerCase();
    if (mediaType === 'image') {
      return true;
    }
    if (mediaType === 'video') {
      return false;
    }
    const mime = String(row.mime_type || '').toLowerCase();
    if (mime.startsWith('image/')) {
      return true;
    }
    if (mime.startsWith('video/')) {
      return false;
    }
    const ext = String(row.file_extension || '').toLowerCase();
    return this.allowedImageExtensions.has(ext);
  }

  protected isVideoRow(row: GuestMemoryRow): boolean {
    return !this.isImageRow(row);
  }

  protected getImageUrl(row: GuestMemoryRow, full = false): string {
    const fileId = this.extractDriveFileId(row);
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${full ? 'w4000' : 'w1600'}`;
    }
    return row.drive_direct_url || row.drive_view_url || '';
  }

  protected getVideoPosterUrl(row: GuestMemoryRow): string {
    const fileId = this.extractDriveFileId(row);
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
    }
    return '';
  }

  protected getVideoPreviewUrl(row: GuestMemoryRow): string {
    const fileId = this.extractDriveFileId(row);
    if (fileId) {
      return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
    }
    return row.drive_view_url || row.drive_direct_url || '';
  }

  private async runWithLock(label: string, action: () => Promise<void>): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    this.actionLoadingText = label;
    this.actionLoading = true;
    try {
      await action();
    } finally {
      this.actionLoading = false;
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private getFileExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    if (idx < 0 || idx === name.length - 1) {
      return '';
    }
    return name.slice(idx + 1).toLowerCase();
  }

  private extractDriveFileId(row: GuestMemoryRow): string {
    const direct = String(row.drive_direct_url || '');
    const view = String(row.drive_view_url || '');

    const idFromQuery = (url: string): string => {
      try {
        const parsed = new URL(url);
        return parsed.searchParams.get('id') || '';
      } catch {
        return '';
      }
    };

    const idFromPath = (url: string): string => {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      return match?.[1] || '';
    };

    return idFromQuery(direct) || idFromPath(view) || '';
  }
}
