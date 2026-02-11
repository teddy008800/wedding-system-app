import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';

declare const supabase: {
  createClient: (url: string, key: string, options?: any) => any;
};

interface RsvpRow {
  id: string;
  name: string;
  email: string;
  guests: number;
  attendance: string;
  message: string | null;
  created_at: string;
}

interface WishRow {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

interface GalleryRow {
  id: string;
  title: string | null;
  image_url: string;
  storage_path: string | null;
  wedding_id: string | null;
  created_at: string;
}

interface NasheedRow {
  id: string;
  title: string;
  audio_url: string;
  storage_path?: string | null;
  created_at: string;
}

interface WeddingRow {
  id: string;
  slug: string;
  groom: string;
  bride: string;
  wedding_date: string;
  venue: string;
  wedding_tag: string | null;
  phone_number: string | null;
  google_map_url: string | null;
  dress_code: string | null;
  wedding_tentative: any;
  nasheed_id: string | null;
  created_at: string;
}

@Component({
  selector: 'app-admin',
  templateUrl: './admin.html',
  standalone: false,
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild('galleryFileInput') galleryFileInput?: ElementRef<HTMLInputElement>;
  protected login = {
    email: '',
    password: ''
  };
  protected loginError = '';
  protected isLoading = false;
  protected isLoggedIn = false;
  protected activeTab: 'rsvp' | 'wishes' | 'gallery' | 'nasheed' | 'weddings' = 'rsvp';
  protected searchRsvp = '';
  protected searchWish = '';
  protected searchGallery = '';
  protected searchNasheed = '';
  protected searchWeddings = '';
  protected searchTerm = '';
  protected pageSize = 5;
  protected rsvpPage = 1;
  protected wishPage = 1;
  protected galleryPage = 1;
  protected nasheedPage = 1;
  protected weddingsPage = 1;
  protected selectedRsvpId: string | null = null;
  protected selectedWishId: string | null = null;
  protected selectedGalleryId: string | null = null;
  protected selectedNasheedId: string | null = null;
  protected selectedWeddingId: string | null = null;

  protected rsvpRows: RsvpRow[] = [];
  protected wishRows: WishRow[] = [];
  protected galleryRows: GalleryRow[] = [];
  protected nasheedRows: NasheedRow[] = [];
  protected weddingRows: WeddingRow[] = [];
  protected likeCounts = new Map<string, number>();

  protected expandedRsvpId: string | null = null;
  protected expandedWishId: string | null = null;
  protected editingRsvp: RsvpRow | null = null;
  protected editingWish: WishRow | null = null;
  protected uploading = false;
  protected nasheedUploading = false;
  protected galleryError = '';
  protected nasheedError = '';
  protected toast = {
    message: '',
    type: '' as 'success' | 'error' | ''
  };
  protected galleryUpload = {
    title: '',
    weddingId: '',
    file: null as File | null
  };
  protected isDragOver = false;
  protected editingGallery: GalleryRow | null = null;
  protected newNasheed = {
    title: '',
    audioUrl: '',
    files: [] as File[]
  };
  protected editingNasheed: NasheedRow | null = null;
  protected editingWedding: WeddingRow | null = null;
  protected viewingWedding: WeddingRow | null = null;
  protected isNasheedDragOver = false;
  protected playingNasheedId: string | null = null;
  protected audioPreview: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private waveformRaf: number | null = null;
  protected confirmModal = {
    open: false,
    message: '',
    onConfirm: null as null | (() => void | Promise<void>)
  };

  private supabaseClient: any | null = null;
  private readonly supabaseUrl = 'https://sksxlvhyjkimyiiaxwtz.supabase.co';
  private readonly supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3hsdmh5amtpbXlpaWF4d3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTQ1NTgsImV4cCI6MjA4NjI3MDU1OH0.wLYx_vlp6jNaW1jN82Ee9dL864kULIUkEc0c7Ruf2ig';
  private inactivityTimer: number | null = null;
  private warningTimer: number | null = null;
  private readonly inactivityTimeoutMs = 300_000;
  private readonly inactivityWarningLeadMs = 30_000;
  private readonly activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
  private activityListenersAttached = false;

  ngOnInit(): void {
    if (this.supabaseUrl.startsWith('http') && this.supabaseAnonKey.length > 20 && typeof supabase !== 'undefined') {
      this.supabaseClient = supabase.createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          multiTab: false,
          storageKey: 'sb-admin-auth-token',
          lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => await fn()
        }
      });
      void this.restoreSession();
    }
  }

  ngOnDestroy(): void {
    this.detachActivityListeners();
    this.clearInactivityTimer();
    this.clearWarningTimer();
  }

  protected async handleLogin(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.loginError = '';
    this.isLoading = true;
    try {
      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email: this.login.email.trim(),
        password: this.login.password
      });
      if (error || !data?.session) {
        throw error ?? new Error('Login failed.');
      }
      this.isLoggedIn = true;
      this.login = { email: '', password: '' };
      await this.logAdminLogin(data.session.user.email ?? 'unknown');
      await this.loadAll();
      this.startInactivityTracking();
    } catch (error) {
      this.loginError = 'Login gagal. Semak email dan kata laluan.';
    } finally {
      this.isLoading = false;
    }
  }

  protected async handleLogout(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    await this.supabaseClient.auth.signOut();
    this.isLoggedIn = false;
    this.rsvpRows = [];
    this.wishRows = [];
    this.galleryRows = [];
    this.nasheedRows = [];
    this.weddingRows = [];
    this.detachActivityListeners();
    this.clearInactivityTimer();
    this.clearWarningTimer();
  }

  protected async refreshData(): Promise<void> {
    await this.loadAll();
  }

  protected switchTab(tab: 'rsvp' | 'wishes' | 'gallery' | 'nasheed' | 'weddings'): void {
    if (tab === this.activeTab) {
      return;
    }
    if (this.hasUnsavedEdits()) {
      this.openConfirm('Unsaved changes will be discarded. Continue?', () => {
        this.resetEditState();
        this.applyTabChange(tab);
      });
      return;
    }
    this.resetEditState();
    this.applyTabChange(tab);
  }

  protected selectRow(type: 'rsvp' | 'wishes' | 'gallery' | 'nasheed' | 'weddings', id: string): void {
    if (type === 'rsvp') {
      this.selectedRsvpId = id;
    } else if (type === 'wishes') {
      this.selectedWishId = id;
    } else if (type === 'gallery') {
      this.selectedGalleryId = id;
    } else if (type === 'nasheed') {
      this.selectedNasheedId = id;
    } else {
      this.selectedWeddingId = id;
    }
  }

  protected setSearchTerm(value: string): void {
    this.searchTerm = value;
    if (this.activeTab === 'rsvp') {
      this.searchRsvp = value;
      this.rsvpPage = 1;
    } else if (this.activeTab === 'wishes') {
      this.searchWish = value;
      this.wishPage = 1;
    } else if (this.activeTab === 'gallery') {
      this.searchGallery = value;
      this.galleryPage = 1;
    } else if (this.activeTab === 'nasheed') {
      this.searchNasheed = value;
      this.nasheedPage = 1;
    } else {
      this.searchWeddings = value;
      this.weddingsPage = 1;
    }
  }

  protected get filteredRsvpRows(): RsvpRow[] {
    const term = this.searchRsvp.trim().toLowerCase();
    if (!term) {
      return this.rsvpRows;
    }
    return this.rsvpRows.filter((row) =>
      [row.name, row.email, row.attendance, row.message ?? ''].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }

  protected get filteredWishRows(): WishRow[] {
    const term = this.searchWish.trim().toLowerCase();
    if (!term) {
      return this.wishRows;
    }
    return this.wishRows.filter((row) =>
      [row.name, row.message].some((value) => value.toLowerCase().includes(term))
    );
  }

  protected get filteredGalleryRows(): GalleryRow[] {
    const term = this.searchGallery.trim().toLowerCase();
    if (!term) {
      return this.galleryRows;
    }
    return this.galleryRows.filter((row) => (row.title ?? '').toLowerCase().includes(term));
  }

  protected get filteredNasheedRows(): NasheedRow[] {
    const term = this.searchNasheed.trim().toLowerCase();
    if (!term) {
      return this.nasheedRows;
    }
    return this.nasheedRows.filter((row) =>
      [row.title, row.audio_url].some((value) => value.toLowerCase().includes(term))
    );
  }

  protected get filteredWeddingRows(): WeddingRow[] {
    const term = this.searchWeddings.trim().toLowerCase();
    if (!term) {
      return this.weddingRows;
    }
    return this.weddingRows.filter((row) =>
      [
        row.slug,
        row.groom,
        row.bride,
        row.venue,
        row.wedding_tag ?? '',
        row.phone_number ?? ''
      ].some((value) => value.toLowerCase().includes(term))
    );
  }

  protected get pagedRsvpRows(): RsvpRow[] {
    return this.paginate(this.filteredRsvpRows, this.rsvpPage);
  }

  protected get pagedWishRows(): WishRow[] {
    return this.paginate(this.filteredWishRows, this.wishPage);
  }

  protected get pagedGalleryRows(): GalleryRow[] {
    return this.paginate(this.filteredGalleryRows, this.galleryPage);
  }

  protected get pagedNasheedRows(): NasheedRow[] {
    return this.paginate(this.filteredNasheedRows, this.nasheedPage);
  }

  protected get pagedWeddingRows(): WeddingRow[] {
    return this.paginate(this.filteredWeddingRows, this.weddingsPage);
  }

  protected get rsvpTotalPages(): number {
    return this.totalPages(this.filteredRsvpRows.length);
  }

  protected get wishTotalPages(): number {
    return this.totalPages(this.filteredWishRows.length);
  }

  protected get galleryTotalPages(): number {
    return this.totalPages(this.filteredGalleryRows.length);
  }

  protected get nasheedTotalPages(): number {
    return this.totalPages(this.filteredNasheedRows.length);
  }

  protected get weddingsTotalPages(): number {
    return this.totalPages(this.filteredWeddingRows.length);
  }

  protected nextPage(type: 'rsvp' | 'wishes' | 'gallery' | 'nasheed' | 'weddings'): void {
    if (type === 'rsvp' && this.rsvpPage < this.rsvpTotalPages) {
      this.rsvpPage += 1;
    }
    if (type === 'wishes' && this.wishPage < this.wishTotalPages) {
      this.wishPage += 1;
    }
    if (type === 'gallery' && this.galleryPage < this.galleryTotalPages) {
      this.galleryPage += 1;
    }
    if (type === 'nasheed' && this.nasheedPage < this.nasheedTotalPages) {
      this.nasheedPage += 1;
    }
    if (type === 'weddings' && this.weddingsPage < this.weddingsTotalPages) {
      this.weddingsPage += 1;
    }
  }

  protected prevPage(type: 'rsvp' | 'wishes' | 'gallery' | 'nasheed' | 'weddings'): void {
    if (type === 'rsvp' && this.rsvpPage > 1) {
      this.rsvpPage -= 1;
    }
    if (type === 'wishes' && this.wishPage > 1) {
      this.wishPage -= 1;
    }
    if (type === 'gallery' && this.galleryPage > 1) {
      this.galleryPage -= 1;
    }
    if (type === 'nasheed' && this.nasheedPage > 1) {
      this.nasheedPage -= 1;
    }
    if (type === 'weddings' && this.weddingsPage > 1) {
      this.weddingsPage -= 1;
    }
  }

  protected handleGalleryFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.galleryUpload.file = input.files?.[0] ?? null;
  }

  protected openGalleryPicker(): void {
    this.galleryFileInput?.nativeElement.click();
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
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.galleryUpload.file = file;
    }
  }

  protected async uploadGallery(): Promise<void> {
    if (!this.supabaseClient || !this.galleryUpload.file) {
      this.galleryError = 'Please select an image to upload.';
      this.showToast(this.galleryError, 'error');
      return;
    }
    if (!this.galleryUpload.weddingId.trim()) {
      this.galleryError = 'Please select wedding.';
      this.showToast(this.galleryError, 'error');
      return;
    }
    this.galleryError = '';
    this.uploading = true;
    try {
      const file = this.galleryUpload.file;
      const filePath = `${Date.now()}-${this.sanitizeFilename(file.name)}`;
      const { error: uploadError } = await this.supabaseClient
        .storage
        .from('gallery')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg'
        });
      if (uploadError) {
        throw uploadError;
      }
      const { data } = this.supabaseClient.storage.from('gallery').getPublicUrl(filePath);
      await this.supabaseClient.from('gallery').insert({
        title: this.galleryUpload.title || null,
        wedding_id: this.galleryUpload.weddingId.trim(),
        image_url: data?.publicUrl ?? '',
        storage_path: filePath,
        created_at: new Date().toISOString()
      });
      this.galleryUpload = { title: '', weddingId: '', file: null };
      await this.loadGallery();
      this.showToast('Gallery uploaded successfully.', 'success');
    } catch {
      this.showToast('Gallery upload failed.', 'error');
    } finally {
      this.uploading = false;
    }
  }

  protected startEditGallery(row: GalleryRow): void {
    this.editingGallery = { ...row };
  }

  protected cancelEditGallery(): void {
    this.editingGallery = null;
  }

  protected async saveGalleryTitle(): Promise<void> {
    if (!this.supabaseClient || !this.editingGallery) {
      return;
    }
    this.openConfirm('Simpan perubahan tajuk gambar ini?', async () => {
      await this.supabaseClient
        .from('gallery')
        .update({ title: this.editingGallery?.title ?? null })
        .eq('id', this.editingGallery?.id);
      this.editingGallery = null;
      await this.loadGallery();
    });
  }

  protected async deleteGallery(row: GalleryRow): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.openConfirm('Padam gambar ini?', async () => {
      const candidates = this.getStoragePathCandidates('gallery', row.storage_path, row.image_url);
      if (candidates.length) {
        const removed = await this.deleteFromStorageWithFallback('gallery', candidates);
        if (!removed) {
          this.showToast('Failed to remove gallery file from storage.', 'error');
          return;
        }
      }
      await this.supabaseClient.from('gallery').delete().eq('id', row.id);
      await this.loadGallery();
      this.showToast('Gallery deleted (table + storage).', 'success');
    });
  }

  protected getGalleryImage(row: GalleryRow): string {
    if (row.image_url) {
      return row.image_url;
    }
    if (row.storage_path && this.supabaseClient) {
      const { data } = this.supabaseClient.storage.from('gallery').getPublicUrl(row.storage_path);
      return data?.publicUrl ?? '';
    }
    return '';
  }

  protected getWeddingSlug(weddingId: string | null): string {
    if (!weddingId) {
      return '-';
    }
    const match = this.weddingRows.find((row) => row.id === weddingId);
    return match?.slug ?? weddingId;
  }

  protected startEditNasheed(row: NasheedRow): void {
    this.editingNasheed = { ...row };
  }

  protected cancelEditNasheed(): void {
    this.editingNasheed = null;
  }

  protected async saveNasheed(): Promise<void> {
    if (!this.supabaseClient || !this.editingNasheed) {
      return;
    }
    this.openConfirm('Simpan perubahan nasheed ini?', async () => {
      await this.supabaseClient
        .from('nasheed')
        .update({
          title: this.editingNasheed?.title ?? '',
          audio_url: this.editingNasheed?.audio_url ?? ''
        })
        .eq('id', this.editingNasheed?.id);
      this.editingNasheed = null;
      await this.loadNasheeds();
    });
  }

  protected async deleteNasheed(row: NasheedRow): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.openConfirm('Padam nasheed ini?', async () => {
      if (this.playingNasheedId === row.id) {
        this.stopPreview();
      }
      const candidates = this.getStoragePathCandidates('nasheed', row.storage_path ?? null, row.audio_url);
      if (candidates.length) {
        const removed = await this.deleteFromStorageWithFallback('nasheed', candidates);
        if (!removed) {
          this.showToast('Failed to remove nasheed file from storage.', 'error');
          return;
        }
      }
      await this.supabaseClient.from('nasheed').delete().eq('id', row.id);
      await this.loadNasheeds();
      this.showToast('Nasheed deleted (table + storage).', 'success');
    });
  }

  protected async createNasheed(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.nasheedError = '';
    const manualUrl = this.newNasheed.audioUrl.trim();
    const files = this.newNasheed.files;
    if (!this.newNasheed.title.trim()) {
      this.nasheedError = 'Title is required.';
      this.showToast(this.nasheedError, 'error');
      return;
    }
    if (!files.length && !manualUrl) {
      this.nasheedError = 'Please upload an MP3 or provide an audio URL.';
      this.showToast(this.nasheedError, 'error');
      return;
    }

    if (files.length) {
      this.nasheedUploading = true;
      for (let index = 0; index < files.length; index += 1) {
        const uploadFile = files[index];
        const filePath = `${Date.now()}-${this.sanitizeFilename(uploadFile.name)}`;
        const { error: uploadError } = await this.supabaseClient
          .storage
          .from('nasheed')
          .upload(filePath, uploadFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: uploadFile.type || 'audio/mpeg'
          });
          
        if (uploadError) {
          this.nasheedError = 'Upload failed. Please try again.';
          this.showToast(this.nasheedError, 'error');
          this.nasheedUploading = false;
          return;
        }
        const { data } = this.supabaseClient.storage.from('nasheed').getPublicUrl(filePath);
        const titleBase = this.newNasheed.title.trim() || uploadFile.name.replace(/\.[^/.]+$/, '');
        const title = files.length > 1 ? `${titleBase} ${index + 1}` : titleBase;

        await this.supabaseClient.from('nasheed').insert({
          title,
          audio_url: data?.publicUrl ?? '',
          storage_path: filePath,
          created_at: new Date().toISOString()
        });


      }
      this.newNasheed = { title: '', audioUrl: '', files: [] };
      await this.loadNasheeds();
      this.showToast('Nasheed uploaded successfully.', 'success');
      this.nasheedUploading = false;
      return;
    }

    await this.supabaseClient.from('nasheed').insert({
      title: this.newNasheed.title.trim() || 'Nasheed',
      audio_url: manualUrl,
      storage_path: null,
      created_at: new Date().toISOString()
    });
    this.newNasheed = { title: '', audioUrl: '', files: [] };
    await this.loadNasheeds();
    this.showToast('Nasheed saved successfully.', 'success');
  }

  protected handleNasheedFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newNasheed.files = input.files ? Array.from(input.files) : [];
  }

  protected handleNasheedDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isNasheedDragOver = true;
  }

  protected handleNasheedDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isNasheedDragOver = false;
  }

  protected handleNasheedDrop(event: DragEvent): void {
    event.preventDefault();
    this.isNasheedDragOver = false;
    const files = event.dataTransfer?.files;
    this.newNasheed.files = files ? Array.from(files) : [];
  }

  protected togglePreview(row: NasheedRow): void {
    if (this.playingNasheedId === row.id) {
      this.stopPreview();
      return;
    }
    this.stopPreview();
    this.audioPreview = new Audio(row.audio_url);
    this.audioPreview.crossOrigin = 'anonymous';
    this.audioPreview.play().catch(() => undefined);
    this.playingNasheedId = row.id;
    this.setupWaveform();
  }

  protected startEditWedding(row: WeddingRow): void {
    const tentative = this.getTentativeList(row);
    this.editingWedding = {
      ...row,
      wedding_tentative: tentative
    };
  }

  protected openWeddingView(row: WeddingRow): void {
    this.viewingWedding = row;
  }

  protected closeWeddingView(): void {
    this.viewingWedding = null;
  }

  protected cancelEditWedding(): void {
    this.editingWedding = null;
  }

  protected async saveWedding(): Promise<void> {
    if (!this.supabaseClient || !this.editingWedding) {
      return;
    }
    this.openConfirm('Simpan perubahan wedding ini?', async () => {
      const normalizedNasheedId = this.normalizeNullableUuid(this.editingWedding?.nasheed_id);
      let tentative: any = null;
      if (Array.isArray(this.editingWedding?.wedding_tentative)) {
        const cleaned = this.editingWedding.wedding_tentative
          .filter((item: any) => item.time || item.title)
          .map((item: any) => ({
            time: String(item.time ?? '').trim(),
            title: String(item.title ?? '').trim()
          }));
        tentative = cleaned.length ? cleaned : null;
      }
      const payload = {
        slug: this.editingWedding?.slug ?? '',
        groom: this.editingWedding?.groom ?? '',
        bride: this.editingWedding?.bride ?? '',
        wedding_date: this.editingWedding?.wedding_date ?? null,
        venue: this.editingWedding?.venue ?? '',
        wedding_tag: this.editingWedding?.wedding_tag ?? null,
        phone_number: this.editingWedding?.phone_number ?? null,
        google_map_url: this.editingWedding?.google_map_url ?? null,
        dress_code: this.editingWedding?.dress_code ?? null,
        wedding_tentative: tentative,
        nasheed_id: normalizedNasheedId
      };
      const { error } = await this.supabaseClient
        .from('weddings')
        .update(payload)
        .eq('id', this.editingWedding?.id);
      if (error) {
        this.showToast(`Failed to update wedding: ${error.message}`, 'error');
        return;
      }
      this.editingWedding = null;
      await this.loadWeddings();
      this.showToast('Wedding updated successfully.', 'success');
    });
  }

  protected addWeddingTentativeRow(): void {
    if (!this.editingWedding) {
      return;
    }
    if (!Array.isArray(this.editingWedding.wedding_tentative)) {
      this.editingWedding.wedding_tentative = [];
    }
    this.editingWedding.wedding_tentative = [
      ...this.editingWedding.wedding_tentative,
      { time: '', title: '' }
    ];
  }

  protected removeWeddingTentativeRow(index: number): void {
    if (!this.editingWedding || !Array.isArray(this.editingWedding.wedding_tentative)) {
      return;
    }
    const updated = this.editingWedding.wedding_tentative.filter((_: any, idx: number) => idx !== index);
    this.editingWedding.wedding_tentative = updated.length ? updated : [{ time: '', title: '' }];
  }

  protected async deleteWedding(id: string): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.openConfirm('Padam wedding ini?', async () => {
      await this.supabaseClient.from('weddings').delete().eq('id', id);
      await this.loadWeddings();
    });
  }

  protected getTentativeList(row: WeddingRow): Array<{ time: string; title: string }> {
    const data = row.wedding_tentative;
    if (!data) {
      return [];
    }
    if (Array.isArray(data)) {
      return data.map((item) => ({
        time: String(item?.time ?? ''),
        title: String(item?.title ?? '')
      }));
    }
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            time: String(item?.time ?? ''),
            title: String(item?.title ?? '')
          }));
        }
      } catch {
        return [];
      }
    }
    return [];
  }

  protected getNasheedTitle(nasheedId: string | null): string {
    if (!nasheedId) {
      return '-';
    }
    const match = this.nasheedRows.find((row) => row.id === nasheedId);
    return match?.title ?? nasheedId;
  }

  private stopPreview(): void {
    if (this.audioPreview) {
      this.audioPreview.pause();
      this.audioPreview.currentTime = 0;
      this.audioPreview.src = '';
      this.audioPreview.load();
      this.audioPreview = null;
    }
    if (this.waveformRaf) {
      cancelAnimationFrame(this.waveformRaf);
      this.waveformRaf = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    this.analyser = null;
    this.playingNasheedId = null;
  }

  private setupWaveform(): void {
    if (!this.audioPreview) {
      return;
    }
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    const source = this.audioContext.createMediaElementSource(this.audioPreview);
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    const draw = () => {
      if (!this.analyser || !this.playingNasheedId) {
        return;
      }
      const canvas = document.getElementById(`waveform-${this.playingNasheedId}`) as HTMLCanvasElement | null;
      if (!canvas) {
        this.waveformRaf = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.waveformRaf = requestAnimationFrame(draw);
        return;
      }
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e11d48';
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i += 1) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      this.waveformRaf = requestAnimationFrame(draw);
    };
    draw();
  }
  protected toggleRsvpDetails(id: string): void {
    this.expandedRsvpId = this.expandedRsvpId === id ? null : id;
  }

  protected toggleWishDetails(id: string): void {
    this.expandedWishId = this.expandedWishId === id ? null : id;
  }

  protected startEditRsvp(row: RsvpRow): void {
    this.editingRsvp = { ...row };
  }

  protected cancelEditRsvp(): void {
    this.editingRsvp = null;
  }

  protected startEditWish(row: WishRow): void {
    this.editingWish = { ...row };
  }

  protected cancelEditWish(): void {
    this.editingWish = null;
  }

  protected async saveRsvp(): Promise<void> {
    if (!this.supabaseClient || !this.editingRsvp) {
      return;
    }
    this.openConfirm('Simpan perubahan RSVP ini?', async () => {
      const payload = {
        name: this.editingRsvp?.name ?? '',
        email: this.editingRsvp?.email ?? '',
        guests: this.editingRsvp?.guests ?? 1,
        attendance: this.editingRsvp?.attendance ?? 'yes',
        message: this.editingRsvp?.message ?? ''
      };
      await this.supabaseClient.from('rsvp').update(payload).eq('id', this.editingRsvp?.id);
      this.editingRsvp = null;
      await this.loadRsvps();
    });
    return;
  }

  protected async saveWish(): Promise<void> {
    if (!this.supabaseClient || !this.editingWish) {
      return;
    }
    this.openConfirm('Simpan perubahan wish ini?', async () => {
      const payload = {
        name: this.editingWish?.name ?? '',
        message: this.editingWish?.message ?? ''
      };
      await this.supabaseClient.from('wishes').update(payload).eq('id', this.editingWish?.id);
      this.editingWish = null;
      await this.loadWishes();
    });
    return;
  }

  protected async deleteRsvp(id: string): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.openConfirm('Padam data RSVP ini?', async () => {
      await this.supabaseClient.from('rsvp').delete().eq('id', id);
      await this.loadRsvps();
    });
  }

  protected async deleteWish(id: string): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.openConfirm('Padam wish ini?', async () => {
      await this.supabaseClient.from('wishes').delete().eq('id', id);
      await this.loadWishes();
      await this.loadLikeCounts();
    });
  }

  protected getLikeCount(id: string): number {
    return this.likeCounts.get(id) ?? 0;
  }

  protected closeConfirm(): void {
    this.confirmModal.open = false;
    this.confirmModal.message = '';
    this.confirmModal.onConfirm = null;
  }

  protected confirmAction(): void {
    void this.runConfirmAction();
  }

  private async runConfirmAction(): Promise<void> {
    try {
      if (this.confirmModal.onConfirm) {
        await this.confirmModal.onConfirm();
      }
    } finally {
      this.closeConfirm();
    }
  }

  private async loadAll(): Promise<void> {
    await Promise.all([
      this.loadRsvps(),
      this.loadWishes(),
      this.loadLikeCounts(),
      this.loadGallery(),
      this.loadNasheeds(),
      this.loadWeddings()
    ]);
  }

  private async loadRsvps(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data } = await this.supabaseClient
      .from('rsvp')
      .select('*')
      .order('created_at', { ascending: false });
    this.rsvpRows = data ?? [];
    this.rsvpPage = 1;
  }

  private async loadWishes(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data } = await this.supabaseClient
      .from('wishes')
      .select('*')
      .order('created_at', { ascending: false });
    this.wishRows = data ?? [];
    this.wishPage = 1;
  }

  private async loadGallery(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data, error } = await this.supabaseClient
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });

    this.galleryRows = (data ?? []).map((row: any) => {
      if (!row.image_url && row.storage_path) {
        const { data: urlData } = this.supabaseClient.storage.from('gallery').getPublicUrl(row.storage_path);
        return { ...row, image_url: urlData?.publicUrl ?? '' };
      }
      return row;
    });
    this.galleryPage = 1;
  }

  private async loadNasheeds(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data } = await this.supabaseClient
      .from('nasheed')
      .select('*')
      .order('created_at', { ascending: false });
    this.nasheedRows = data ?? [];
    this.nasheedPage = 1;
  }

  private async loadWeddings(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data } = await this.supabaseClient
      .from('weddings')
      .select('*')
      .order('created_at', { ascending: false });
    this.weddingRows = data ?? [];
    this.weddingsPage = 1;
  }

  private async loadLikeCounts(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data } = await this.supabaseClient
      .from('wish_likes')
      .select('wish_id');

    const counts = new Map<string, number>();
    (data ?? []).forEach((row: any) => {
      counts.set(row.wish_id, (counts.get(row.wish_id) ?? 0) + 1);
    });
    this.likeCounts = counts;
  }

  private async logAdminLogin(email: string): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    try {
      await this.supabaseClient.from('admin_logins').insert({
        email,
        created_at: new Date().toISOString()
      });
    } catch {
      // Ignore logging errors.
    }
  }

  private openConfirm(message: string, onConfirm: () => void | Promise<void>): void {
    this.confirmModal.open = true;
    this.confirmModal.message = message;
    this.confirmModal.onConfirm = onConfirm;
  }

  private normalizeNullableUuid(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private isStorageMissingError(error: { message?: string } | null): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    return message.includes('not found') || message.includes('no such object');
  }

  private isStorageInvalidKeyError(error: { message?: string } | null): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    return message.includes('invalid key') || message.includes('bad request');
  }

  private async restoreSession(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data, error } = await this.supabaseClient.auth.getSession();
    if (error || !data?.session) {
      return;
    }
    this.isLoggedIn = true;
    await this.loadAll();
    this.startInactivityTracking();
  }

  private readonly onActivity = (): void => {
    if (!this.isLoggedIn) {
      return;
    }
    this.resetInactivityTimer();
  };

  private startInactivityTracking(): void {
    this.attachActivityListeners();
    this.resetInactivityTimer();
  }

  private attachActivityListeners(): void {
    if (this.activityListenersAttached) {
      return;
    }
    this.activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, this.onActivity, { passive: true });
    });
    this.activityListenersAttached = true;
  }

  private detachActivityListeners(): void {
    if (!this.activityListenersAttached) {
      return;
    }
    this.activityEvents.forEach((eventName) => {
      window.removeEventListener(eventName, this.onActivity);
    });
    this.activityListenersAttached = false;
  }

  private resetInactivityTimer(): void {
    this.clearInactivityTimer();
    this.clearWarningTimer();
    const warningDelay = Math.max(0, this.inactivityTimeoutMs - this.inactivityWarningLeadMs);
    this.warningTimer = window.setTimeout(() => {
      if (!this.isLoggedIn) {
        return;
      }
      this.showToast('Session will expire in 30 seconds.', 'error');
    }, warningDelay);
    this.inactivityTimer = window.setTimeout(() => {
      if (!this.isLoggedIn) {
        return;
      }
      this.showToast('Session expired due to inactivity.', 'error');
      void this.handleLogout();
    }, this.inactivityTimeoutMs);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      window.clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private clearWarningTimer(): void {
    if (this.warningTimer) {
      window.clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  private getStoragePathCandidates(bucket: string, storagePath: string | null, publicUrl: string | null): string[] {
    const candidates: string[] = [];
    if (storagePath) {
      candidates.push(...this.expandPathVariants(bucket, storagePath));
    }
    const pathFromUrl = this.extractStoragePathFromPublicUrl(bucket, publicUrl);
    if (pathFromUrl) {
      candidates.push(...this.expandPathVariants(bucket, pathFromUrl));
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  private expandPathVariants(bucket: string, rawPath: string): string[] {
    const source = String(rawPath || '').trim();
    if (!source) {
      return [];
    }
    const decoded = decodeURIComponent(source);
    const normalize = (value: string): string => value.replace(/^\/+/, '');
    const stripBucketPrefix = (value: string): string =>
      normalize(value).replace(new RegExp(`^${bucket}/`), '');

    const normalized = normalize(source);
    const decodedNormalized = normalize(decoded);
    const stripped = stripBucketPrefix(source);
    const strippedDecoded = stripBucketPrefix(decoded);

    return [
      normalized,
      decodedNormalized,
      stripped,
      strippedDecoded
    ];
  }

  private extractStoragePathFromPublicUrl(bucket: string, publicUrl: string | null): string | null {
    const url = String(publicUrl ?? '');
    const marker = `/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    if (index < 0) {
      return null;
    }
    return url.slice(index + marker.length).split('?')[0] || null;
  }

  private async deleteFromStorageWithFallback(bucket: string, paths: string[]): Promise<boolean> {
    if (!this.supabaseClient || !paths.length) {
      return false;
    }

    // Try delete all candidate paths (some rows contain different stored path variants).
    let hadHardError = false;
    const validPaths = paths
      .map((path) => String(path || '').trim().replace(/^\/+/, ''))
      .filter((path) => path && !path.startsWith('http://') && !path.startsWith('https://'));

    // First try server-side delete (service role) so storage cleanup works even when anon delete is restricted.
    const serverDeleted = await this.deleteViaServerApi(bucket, validPaths);
    if (serverDeleted) {
      return true;
    }

    for (const path of validPaths) {
      const { data, error } = await this.supabaseClient.storage.from(bucket).remove([path]);
      console.info(`[${bucket}] storage remove result`, { path, data, error });
      if (error && !this.isStorageMissingError(error) && !this.isStorageInvalidKeyError(error)) {
        hadHardError = true;
      }
    }

    if (hadHardError) {
      return false;
    }

    // Verify the file is no longer present for any candidate name/path.
    for (const path of validPaths) {
      const stillExists = await this.storageObjectExists(bucket, path);
      if (stillExists) {
        console.warn(`[${bucket}] storage object still exists after delete`, { path });
        const filename = path.split('/').pop() ?? '';
        if (filename) {
          const forced = await this.forceDeleteByFilename(bucket, filename);
          console.info(`[${bucket}] force delete by filename`, { filename, forced });
          if (forced) {
            const existsAfterForce = await this.storageObjectExists(bucket, path);
            if (!existsAfterForce) {
              continue;
            }
          }
        }
        return false;
      }
    }
    return true;
  }

  private async forceDeleteByFilename(bucket: string, filename: string): Promise<boolean> {
    if (!this.supabaseClient || !filename) {
      return false;
    }
    const targets = new Set<string>();

    const root = await this.supabaseClient.storage.from(bucket).list('', { limit: 1000, search: filename });
    (root.data ?? []).forEach((item: any) => {
      if (item?.name === filename) {
        targets.add(item.name);
      }
    });

    // Try one-level folder scan to catch objects stored under legacy folder names.
    const allRoot = await this.supabaseClient.storage.from(bucket).list('', { limit: 1000 });
    for (const rootItem of allRoot.data ?? []) {
      const folder = String(rootItem?.name ?? '');
      if (!folder) {
        continue;
      }
      const nested = await this.supabaseClient.storage.from(bucket).list(folder, { limit: 1000, search: filename });
      (nested.data ?? []).forEach((item: any) => {
        if (item?.name === filename) {
          targets.add(`${folder}/${item.name}`);
        }
      });
    }

    if (!targets.size) {
      return false;
    }
    const targetPaths = Array.from(targets);
    const { data, error } = await this.supabaseClient.storage.from(bucket).remove(targetPaths);
    console.info(`[${bucket}] force remove targets`, { targetPaths, data, error });
    return !error;
  }

  private async deleteViaServerApi(bucket: string, paths: string[]): Promise<boolean> {
    if (!this.supabaseClient || !paths.length) {
      return false;
    }
    try {
      const { data: sessionData } = await this.supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        return false;
      }

      const response = await fetch('/api/storage-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bucket, paths })
      });

      const payload = await response.json().catch(() => ({}));
      console.info(`[${bucket}] server storage delete`, { paths, status: response.status, payload });
      return response.ok;
    } catch (error) {
      console.warn(`[${bucket}] server storage delete failed`, { paths, error });
      return false;
    }
  }

  private async storageObjectExists(bucket: string, path: string): Promise<boolean> {
    if (!this.supabaseClient) {
      return false;
    }
    const normalized = path.replace(/^\/+/, '');
    const parts = normalized.split('/');
    const filename = parts.pop() ?? '';
    const folder = parts.join('/');
    if (!filename) {
      return false;
    }
    const { data, error } = await this.supabaseClient.storage.from(bucket).list(folder || '', {
      limit: 100,
      search: filename
    });
    if (error) {
      console.warn(`[${bucket}] storage list verify failed`, { path: normalized, error });
      return false;
    }
    return (data ?? []).some((item: any) => item?.name === filename);
  }

  private paginate<T>(rows: T[], page: number): T[] {
    const start = (page - 1) * this.pageSize;
    return rows.slice(start, start + this.pageSize);
  }

  private totalPages(total: number): number {
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  private currentSearchValue(): string {
    if (this.activeTab === 'rsvp') {
      return this.searchRsvp;
    }
    if (this.activeTab === 'wishes') {
      return this.searchWish;
    }
    if (this.activeTab === 'gallery') {
      return this.searchGallery;
    }
    if (this.activeTab === 'nasheed') {
      return this.searchNasheed;
    }
    return this.searchWeddings;
  }

  private applyTabChange(tab: 'rsvp' | 'wishes' | 'gallery' | 'nasheed' | 'weddings'): void {
    this.activeTab = tab;
    this.searchTerm = this.currentSearchValue();
  }

  private hasUnsavedEdits(): boolean {
    return Boolean(
      this.editingRsvp ||
        this.editingWish ||
        this.editingGallery ||
        this.editingNasheed ||
        this.editingWedding
    );
  }

  private resetEditState(): void {
    this.editingRsvp = null;
    this.editingWish = null;
    this.editingGallery = null;
    this.editingNasheed = null;
    this.editingWedding = null;
    this.expandedRsvpId = null;
    this.expandedWishId = null;
    this.selectedRsvpId = null;
    this.selectedWishId = null;
    this.selectedGalleryId = null;
    this.selectedNasheedId = null;
    this.selectedWeddingId = null;
  }

  private sanitizeFilename(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9.\-]/g, '-');
    const clean = base.replace(/-+/g, '-').replace(/^\-|\-$/g, '');
    return clean || `file-${Date.now()}`;
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { message, type };
    window.setTimeout(() => {
      this.toast = { message: '', type: '' };
    }, 2400);
  }
}
