import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

declare const supabase: {
  createClient: (url: string, key: string, options?: any) => any;
};

type AttendanceOption = 'yes' | 'no' | 'maybe';

interface Wish {
  id: string;
  name: string;
  message: string;
  likes: number;
  createdAt: string;
}

interface HeartBurst {
  id: number;
  x: number;
  y: number;
}

interface GalleryItem {
  id: string;
  title: string | null;
  imageUrl: string;
  createdAt: string;
  weddingId?: string | null;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.html',
  standalone: false,
  styleUrl: './app.css'
})
export class LandingComponent implements OnInit, OnDestroy {
  @ViewChild('nasheed') nasheed?: ElementRef<HTMLAudioElement>;

  protected title = 'WeddingAqilSyafiqah';
  protected couple = {
    groom: 'Groom Name (Aqil)',
    bride: 'Bride Name (Syafiqah)',
    date: '12 April 2026',
    location: 'Masjid Negara, Kuala Lumpur'
  };
  protected weddingTag = '#AqilSyafiqah';
  protected phoneNumber = '+60 12-345 6789';
  protected googleMapUrl = '';
  protected dressCode = 'Soft Pastel / Traditional';
  protected weddingTentative: Array<{ time: string; title: string }> = [];
  protected nasheedUrl = '';
  protected year = new Date().getFullYear();
  protected countdown = {
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00'
  };

  protected isDark = false;
  protected audioEnabled = false;
  protected audioPlaying = false;

  protected wishes: Wish[] = [
    {
      id: 'local-1',
      name: 'Alya',
      message: 'Semoga bahagia hingga Jannah!',
      likes: 12,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-2',
      name: 'Haziq',
      message: 'Barakallah, beautiful celebration.',
      likes: 8,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-3',
      name: 'Nadia',
      message: 'So excited for your big day!',
      likes: 5,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-4',
      name: 'Farhan',
      message: 'Mabruk! Semoga dipermudahkan semua urusan.',
      likes: 10,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-5',
      name: 'Syaza',
      message: 'Doa terbaik untuk kedua mempelai.',
      likes: 7,
      createdAt: new Date().toISOString()
    }
  ];
  protected newWish = {
    name: '',
    message: ''
  };
  protected heartBursts: HeartBurst[] = [];
  protected visibleStart = 0;
  protected exitingWish: Wish | null = null;
  protected enteringWishId: string | null = null;
  protected rotationPaused = false;
  protected wishPopup = '';
  protected wishCooldown = 0;
  protected isStandaloneRoute = false;
  protected galleryItems: GalleryItem[] = [
    {
      id: 'local-g-1',
      title: 'Pre-Wedding Moment',
      imageUrl: 'https://picsum.photos/seed/wedding-1/1200/900',
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-g-2',
      title: 'Family Blessing',
      imageUrl: 'https://picsum.photos/seed/wedding-2/1200/900',
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-g-3',
      title: 'Engagement Day',
      imageUrl: 'https://picsum.photos/seed/wedding-3/1200/900',
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-g-4',
      title: 'Special Memory',
      imageUrl: 'https://picsum.photos/seed/wedding-4/1200/900',
      createdAt: new Date().toISOString()
    }
  ];

  protected rsvp = {
    name: '',
    email: '',
    guests: 1,
    attendance: 'yes' as AttendanceOption,
    message: ''
  };
  protected rsvpLoading = false;
  protected rsvpResult = '';
  protected rsvpPopup = '';

  private heartId = 0;
  private scrollResumeId: number | null = null;
  private cycleTimer: number | null = null;
  private supabaseClient: any | null = null;
  private readonly supabaseUrl = 'https://sksxlvhyjkimyiiaxwtz.supabase.co';
  private readonly supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3hsdmh5amtpbXlpaWF4d3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTQ1NTgsImV4cCI6MjA4NjI3MDU1OH0.wLYx_vlp6jNaW1jN82Ee9dL864kULIUkEc0c7Ruf2ig';
  private readonly defaultWeddingDate = new Date('2026-04-12T00:00:00');
  private readonly defaultWishes: Wish[] = [
    {
      id: 'local-1',
      name: 'Alya',
      message: 'Semoga bahagia hingga Jannah!',
      likes: 12,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-2',
      name: 'Haziq',
      message: 'Barakallah, beautiful celebration.',
      likes: 8,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-3',
      name: 'Nadia',
      message: 'So excited for your big day!',
      likes: 5,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-4',
      name: 'Farhan',
      message: 'Mabruk! Semoga dipermudahkan semua urusan.',
      likes: 10,
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-5',
      name: 'Syaza',
      message: 'Doa terbaik untuk kedua mempelai.',
      likes: 7,
      createdAt: new Date().toISOString()
    }
  ];
  private readonly defaultGalleryItems: GalleryItem[] = [
    {
      id: 'local-g-1',
      title: 'Pre-Wedding Moment',
      imageUrl: 'https://picsum.photos/seed/wedding-1/1200/900',
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-g-2',
      title: 'Family Blessing',
      imageUrl: 'https://picsum.photos/seed/wedding-2/1200/900',
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-g-3',
      title: 'Engagement Day',
      imageUrl: 'https://picsum.photos/seed/wedding-3/1200/900',
      createdAt: new Date().toISOString()
    },
    {
      id: 'local-g-4',
      title: 'Special Memory',
      imageUrl: 'https://picsum.photos/seed/wedding-4/1200/900',
      createdAt: new Date().toISOString()
    }
  ];
  private currentSlug = '';
  private currentWeddingId: string | null = null;
  private readonly cycleIntervalMs = 4500;
  private readonly sessionIdKey = 'wedding-session-id';
  private sessionId = '';
  private likedWishIds = new Set<string>();
  private likePulseTimers = new Map<string, number>();
  private wishCooldownTimer: number | null = null;
  private popupTimer: number | null = null;
  private countdownTimer: number | null = null;
  private countdownTargetMs: number | null = null;
  private routerSub?: { unsubscribe: () => void };
  private autoplayListenersAttached = false;
  private readonly autoplayEvents: Array<keyof WindowEventMap> = ['click', 'touchend', 'keydown'];
  private readonly defaultWeddingState = {
    couple: {
      groom: this.couple.groom,
      bride: this.couple.bride,
      date: this.couple.date,
      location: this.couple.location
    },
    weddingTag: this.weddingTag,
    phoneNumber: this.phoneNumber,
    googleMapUrl: this.googleMapUrl,
    dressCode: this.dressCode,
    weddingTentative: [] as Array<{ time: string; title: string }>,
    nasheedUrl: this.nasheedUrl
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.isDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    this.syncTheme();
    this.initSessionId();
    this.initSupabase();
    this.startWishCycle();
    this.setCountdownTargetFromWeddingDate(this.defaultWeddingDate);
    this.startCountdownTimer();
    this.syncRouteFlag(this.router.url);
    this.routerSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.syncRouteFlag(event.urlAfterRedirects);
        this.handleSlugRoute(event.urlAfterRedirects);
      }
    });
    this.handleSlugRoute(this.router.url);
    this.attachAutoplayListeners();
  }

  ngOnDestroy(): void {
    if (this.scrollResumeId) {
      window.clearTimeout(this.scrollResumeId);
    }
    if (this.cycleTimer) {
      window.clearInterval(this.cycleTimer);
    }
    if (this.wishCooldownTimer) {
      window.clearInterval(this.wishCooldownTimer);
    }
    if (this.popupTimer) {
      window.clearTimeout(this.popupTimer);
    }
    if (this.countdownTimer) {
      window.clearInterval(this.countdownTimer);
    }
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
    this.detachAutoplayListeners();
    if (this.supabaseClient) {
      this.supabaseClient.removeAllChannels();
    }
  }

  protected toggleDark(): void {
    this.isDark = !this.isDark;
    this.syncTheme();
  }

  protected toggleAudio(): void {
    const audio = this.nasheed?.nativeElement;
    if (!audio || !this.nasheedUrl) {
      return;
    }

    if (audio.paused) {
      void this.safePlayAudio(audio);
    } else {
      audio.pause();
      this.audioEnabled = false;
      this.audioPlaying = false;
    }
  }

  protected async submitWish(): Promise<void> {
    if (this.wishCooldown > 0) {
      return;
    }
    if (!this.newWish.name.trim() || !this.newWish.message.trim()) {
      return;
    }

    const payload = {
      name: this.newWish.name.trim(),
      message: this.newWish.message.trim(),
      wedding_id: this.currentWeddingId
    };

    if (!this.currentSlug) {
      const wish: Wish = {
        id: `local-${Date.now()}`,
        name: payload.name,
        message: payload.message,
        likes: 0,
        createdAt: new Date().toISOString()
      };
      this.wishes = [wish, ...this.wishes];
      this.newWish = { name: '', message: '' };
      this.resetCycle();
      this.showWishPopup('Ucapan dihantar! (Demo)');
      this.startWishCooldown();
      return;
    }

    if (!this.supabaseClient) {
      const wish: Wish = {
        id: `local-${Date.now()}`,
        name: payload.name,
        message: payload.message,
        likes: 0,
        createdAt: new Date().toISOString()
      };
      this.wishes = [wish, ...this.wishes];
      this.newWish = { name: '', message: '' };
      this.resetCycle();
      this.showWishPopup('Ucapan dihantar!');
      this.startWishCooldown();
      return;
    }

    const { data, error } = await this.supabaseClient
      .from('wishes')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      const wish: Wish = {
        id: data.id,
        name: data.name,
        message: data.message,
        likes: data.likes_count ?? 0,
        createdAt: data.created_at ?? new Date().toISOString()
      };
      this.wishes = [wish, ...this.wishes];
      this.newWish = { name: '', message: '' };
      this.resetCycle();
      this.showWishPopup('Ucapan dihantar!');
      this.startWishCooldown();
    }
  }

  protected async likeWish(wish: Wish, event: MouseEvent): Promise<void> {
    if (this.likedWishIds.has(wish.id)) {
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    const x = (rect?.left ?? window.innerWidth / 2) + (rect?.width ?? 0) / 2 + (Math.random() * 24 - 12);
    const y = (rect?.top ?? window.innerHeight / 2) - 16;
    const id = ++this.heartId;
    this.heartBursts = [...this.heartBursts, { id, x, y }];
    window.setTimeout(() => {
      this.heartBursts = this.heartBursts.filter((heart) => heart.id !== id);
    }, 1300);

    if (!this.supabaseClient || !this.currentSlug || wish.id.startsWith('local-')) {
      this.likedWishIds.add(wish.id);
      wish.likes += 1;
      this.pulseLike(wish.id);
      return;
    }

    const { error: likeError } = await this.supabaseClient.from('wish_likes').insert({
      wish_id: wish.id,
      session_id: this.sessionId
    });

    if (likeError) {
      return;
    }

    this.likedWishIds.add(wish.id);
    wish.likes += 1;
    this.pulseLike(wish.id);
  }

  protected async submitRsvp(): Promise<void> {
    this.rsvpResult = '';

    if (!this.currentSlug) {
      this.rsvpResult = 'Demo submit success.';
      this.rsvp = { name: '', email: '', guests: 1, attendance: 'yes', message: '' };
      this.showRsvpPopup('RSVP berjaya dihantar! (Demo)');
      return;
    }

    if (!this.supabaseClient) {
      this.rsvpResult = 'Supabase is not configured yet. Please add your URL and anon key.';
      return;
    }

    this.rsvpLoading = true;
    try {
      const payload = {
        name: this.rsvp.name.trim(),
        email: this.rsvp.email.trim(),
        guests: this.rsvp.guests,
        attendance: this.rsvp.attendance,
        message: this.rsvp.message.trim(),
        wedding_id: this.currentWeddingId,
        created_at: new Date().toISOString()
      };

      const response = await this.supabaseClient.from('rsvp').insert(payload);
      if (response?.error) {
        throw response.error;
      }

      this.rsvpResult = 'RSVP submitted. Thank you!';
      this.rsvp = { name: '', email: '', guests: 1, attendance: 'yes', message: '' };
      this.showRsvpPopup('RSVP berjaya dihantar!');
    } catch (error) {
      this.rsvpResult = 'Unable to submit RSVP right now. Please try again.';
    } finally {
      this.rsvpLoading = false;
    }
  }

  @HostListener('window:scroll')
  protected handleScroll(): void {
    const audio = this.nasheed?.nativeElement;
    if (!audio || !this.nasheedUrl) {
      return;
    }

    if (!this.audioEnabled) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
      this.audioPlaying = false;
    }

    if (this.scrollResumeId) {
      window.clearTimeout(this.scrollResumeId);
    }

    this.scrollResumeId = window.setTimeout(() => {
      void this.safePlayAudio(audio);
    }, 800);
  }

  protected isWishLiked(wishId: string): boolean {
    return this.likedWishIds.has(wishId);
  }

  protected get visibleWishes(): Wish[] {
    if (this.wishes.length <= 3) {
      return this.wishes;
    }
    const results: Wish[] = [];
    for (let offset = 0; offset < 3; offset += 1) {
      const index = (this.visibleStart + offset) % this.wishes.length;
      results.push(this.wishes[index]);
    }
    return results;
  }

  private syncTheme(): void {
    document.documentElement.classList.toggle('dark', this.isDark);
  }

  private syncRouteFlag(url: string): void {
    this.isStandaloneRoute = url.startsWith('/admin') || url.startsWith('/register');
  }

  private handleSlugRoute(url: string): void {
    const path = url.split('#')[0].split('?')[0].replace(/^\/+/, '');
    const slug = path.split('/')[0];
    if (!slug || slug === 'admin' || slug === 'register') {
      this.currentSlug = '';
      this.currentWeddingId = null;
      this.applyDefaultWeddingState();
      this.setCountdownTargetFromWeddingDate(this.defaultWeddingDate);
      this.refreshSlugScopedData();
      return;
    }
    if (slug === this.currentSlug) {
      return;
    }
    this.currentSlug = slug;
    this.loadWeddingBySlug(slug);
  }

  protected setRotationPaused(isPaused: boolean): void {
    this.rotationPaused = isPaused;
  }

  protected shouldPulseLike(wishId: string): boolean {
    return this.likePulseTimers.has(wishId);
  }

  protected get canSubmitWish(): boolean {
    return this.wishCooldown === 0;
  }

  protected get coupleInitials(): string {
    const groomInitial = (this.couple.groom || '').trim().charAt(0).toUpperCase();
    const brideInitial = (this.couple.bride || '').trim().charAt(0).toUpperCase();
    return `${groomInitial}${brideInitial}` || 'AS';
  }

  protected goToSection(sectionId: string, event?: Event): void {
    event?.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    void this.router.navigate([], { fragment: sectionId, replaceUrl: true });
  }

  private initSessionId(): void {
    const existing = window.localStorage.getItem(this.sessionIdKey);
    if (existing) {
      this.sessionId = existing;
      return;
    }
    const newId = `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    window.localStorage.setItem(this.sessionIdKey, newId);
    this.sessionId = newId;
  }

  private initSupabase(): void {
    if (this.supabaseUrl.startsWith('http') && this.supabaseAnonKey.length > 20 && typeof supabase !== 'undefined') {
      this.supabaseClient = supabase.createClient(
        this.supabaseUrl,
        this.supabaseAnonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );
      this.loadWishes();
      this.loadLikes();
      this.loadGallery();
      this.subscribeRealtime();
    }
  }

  protected get galleryLoop(): GalleryItem[] {
    if (!this.galleryItems.length) {
      return [];
    }
    if (this.galleryItems.length >= 6) {
      return [...this.galleryItems, ...this.galleryItems];
    }
    return [...this.galleryItems, ...this.galleryItems, ...this.galleryItems];
  }

  private async loadWishes(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    if (!this.currentSlug && !this.currentWeddingId) {
      this.wishes = this.defaultWishes.map((item) => ({ ...item }));
      this.resetCycle();
      return;
    }
    if (this.currentSlug && !this.currentWeddingId) {
      this.wishes = [];
      return;
    }
    let query = this.supabaseClient
      .from('wishes')
      .select('*')
      .order('created_at', { ascending: false });
    if (this.currentWeddingId) {
      query = query.eq('wedding_id', this.currentWeddingId);
    }
    const { data, error } = await query;

    if (!error && data) {
      this.wishes = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        message: row.message,
        likes: 0,
        createdAt: row.created_at ?? new Date().toISOString()
      }));
      await this.loadLikeCounts();
      this.resetCycle();
    }
  }

  private async loadLikes(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data, error } = await this.supabaseClient
      .from('wish_likes')
      .select('wish_id')
      .eq('session_id', this.sessionId);

    if (!error && data) {
      data.forEach((row: any) => this.likedWishIds.add(row.wish_id));
    }
  }

  private async loadLikeCounts(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data, error } = await this.supabaseClient
      .from('wish_likes')
      .select('wish_id');

    if (error || !data) {
      return;
    }

    const counts = new Map<string, number>();
    data.forEach((row: any) => {
      counts.set(row.wish_id, (counts.get(row.wish_id) ?? 0) + 1);
    });

    this.wishes = this.wishes.map((wish) => ({
      ...wish,
      likes: counts.get(wish.id) ?? 0
    }));
  }

  private async loadGallery(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    if (!this.currentSlug && !this.currentWeddingId) {
      this.galleryItems = this.defaultGalleryItems.map((item) => ({ ...item }));
      return;
    }
    if (this.currentSlug && !this.currentWeddingId) {
      this.galleryItems = [];
      return;
    }
    let query = this.supabaseClient
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });
    if (this.currentWeddingId) {
      query = query.eq('wedding_id', this.currentWeddingId);
    }
    const { data, error } = await query;

    if (!error && data) {
      this.galleryItems = data.map((row: any) => {
        if (!row.image_url && row.storage_path) {
          const { data: urlData } = this.supabaseClient.storage.from('gallery').getPublicUrl(row.storage_path);
          return {
            id: row.id,
            title: row.title ?? null,
            imageUrl: urlData?.publicUrl ?? '',
            createdAt: row.created_at ?? new Date().toISOString(),
            weddingId: row.wedding_id ?? null
          };
        }
        return {
          id: row.id,
          title: row.title ?? null,
          imageUrl: row.image_url ?? '',
          createdAt: row.created_at ?? new Date().toISOString(),
          weddingId: row.wedding_id ?? null
        };
      });
    }
  }

  private async loadWeddingBySlug(slug: string): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    this.applyDefaultWeddingState();
    const { data } = await this.supabaseClient
      .from('weddings')
      .select('*')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (!data) {
      this.currentWeddingId = null;
      this.setCountdownTargetFromWeddingDate(null);
      this.refreshSlugScopedData();
      return;
    }
    this.currentWeddingId = data.id ?? null;
    const weddingDate = this.parseWeddingDate(data.wedding_date);
    this.couple = {
      groom: data.groom || this.defaultWeddingState.couple.groom,
      bride: data.bride || this.defaultWeddingState.couple.bride,
      date: weddingDate ? this.formatWeddingDate(weddingDate) : this.defaultWeddingState.couple.date,
      location: data.venue || this.defaultWeddingState.couple.location
    };
    this.weddingTag = data.wedding_tag ? `#${String(data.wedding_tag).replace(/^#/, '')}` : this.defaultWeddingState.weddingTag;
    this.phoneNumber = data.phone_number || this.defaultWeddingState.phoneNumber;
    this.googleMapUrl = data.google_map_url || this.defaultWeddingState.googleMapUrl;
    this.dressCode = data.dress_code || this.defaultWeddingState.dressCode;
    this.weddingTentative = Array.isArray(data.wedding_tentative)
      ? data.wedding_tentative.map((item: any) => ({
          time: String(item?.time ?? ''),
          title: String(item?.title ?? item?.activity ?? '')
        }))
      : [];
    this.year = weddingDate?.getFullYear() ?? new Date().getFullYear();
    this.setCountdownTargetFromWeddingDate(weddingDate);
    if (data.nasheed_id) {
      const { data: nasheed } = await this.supabaseClient
        .from('nasheed')
      .select('audio_url')
      .eq('id', data.nasheed_id)
      .maybeSingle();
      if (nasheed?.audio_url) {
        this.nasheedUrl = nasheed.audio_url;
        this.syncAudioSource();
      }
    }
    
    this.refreshSlugScopedData();
  }

  private applyDefaultWeddingState(): void {
    const audio = this.nasheed?.nativeElement;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.couple = { ...this.defaultWeddingState.couple };
    this.weddingTag = this.defaultWeddingState.weddingTag;
    this.phoneNumber = this.defaultWeddingState.phoneNumber;
    this.googleMapUrl = this.defaultWeddingState.googleMapUrl;
    this.dressCode = this.defaultWeddingState.dressCode;
    this.weddingTentative = [...this.defaultWeddingState.weddingTentative];
    this.nasheedUrl = this.defaultWeddingState.nasheedUrl;
    this.syncAudioSource();
    this.audioEnabled = false;
    this.audioPlaying = false;
    this.year = new Date().getFullYear();
  }

  private async tryAutoPlayNasheed(): Promise<void> {
    const audio = this.nasheed?.nativeElement;
    if (!audio || !this.nasheedUrl) {
      return;
    }
    const played = await this.safePlayAudio(audio);
    if (played) {
      this.detachAutoplayListeners();
    }
  }

  private async safePlayAudio(audio: HTMLAudioElement): Promise<boolean> {
    if (!this.nasheedUrl) {
      return false;
    }
    const playPromise = audio.play();
    if (!playPromise || typeof playPromise.then !== 'function') {
      this.audioEnabled = true;
      this.audioPlaying = true;
      return true;
    }
    return playPromise.then(() => {
      this.audioEnabled = true;
      this.audioPlaying = true;
      return true;
    }).catch((error: unknown) => {
      this.audioEnabled = false;
      this.audioPlaying = false;
      return false;
    });
  }

  private syncAudioSource(): void {
    const audio = this.nasheed?.nativeElement;
    if (!audio) {
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.load();
  }

  private readonly onAutoplayInteraction = (): void => {
    if (!this.nasheedUrl) {
      return;
    }
    void this.tryAutoPlayNasheed();
  };

  private attachAutoplayListeners(): void {
    if (this.autoplayListenersAttached) {
      return;
    }
    this.autoplayEvents.forEach((eventName) => {
      window.addEventListener(eventName, this.onAutoplayInteraction, { passive: true });
    });
    this.autoplayListenersAttached = true;
  }

  private detachAutoplayListeners(): void {
    if (!this.autoplayListenersAttached) {
      return;
    }
    this.autoplayEvents.forEach((eventName) => {
      window.removeEventListener(eventName, this.onAutoplayInteraction);
    });
    this.autoplayListenersAttached = false;
  }

  private parseWeddingDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return null;
    }
    const date = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  private formatWeddingDate(date: Date): string {
    return date.toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  private setCountdownTargetFromWeddingDate(date: Date | null): void {
    this.countdownTargetMs = date ? date.getTime() : null;
    this.updateCountdown();
  }

  private startCountdownTimer(): void {
    if (this.countdownTimer) {
      window.clearInterval(this.countdownTimer);
    }
    this.updateCountdown();
    this.countdownTimer = window.setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  private updateCountdown(): void {
    if (!this.countdownTargetMs) {
      this.countdown = { days: '00', hours: '00', minutes: '00', seconds: '00' };
      return;
    }
    const now = Date.now();
    const diff = Math.max(0, this.countdownTargetMs - now);
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    this.countdown = {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  }

  private subscribeRealtime(): void {
    if (!this.supabaseClient) {
      return;
    }
    this.supabaseClient
      .channel('public:wishes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wishes' },
        (payload: any) => {
          const row = payload.new;
          if (this.currentSlug && this.currentWeddingId && row.wedding_id !== this.currentWeddingId) {
            return;
          }
          if (this.wishes.some((wish) => wish.id === row.id)) {
            return;
          }
          const wish: Wish = {
            id: row.id,
            name: row.name,
            message: row.message,
            likes: 0,
            createdAt: row.created_at ?? new Date().toISOString()
          };
          this.wishes = [wish, ...this.wishes];
          this.resetCycle();
        }
      )
      .subscribe();

    this.supabaseClient
      .channel('public:wish_likes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wish_likes' },
        (payload: any) => {
          const row = payload.new;
          if (row.session_id === this.sessionId && this.likedWishIds.has(row.wish_id)) {
            return;
          }
          const wish = this.wishes.find((item) => item.id === row.wish_id);
          if (wish) {
            wish.likes += 1;
            this.pulseLike(wish.id);
          }
          if (row.session_id === this.sessionId) {
            this.likedWishIds.add(row.wish_id);
          }
        }
      )
      .subscribe();
  }

  private refreshSlugScopedData(): void {
    if (!this.supabaseClient) {
      return;
    }
    this.wishes = [];
    this.galleryItems = [];
    this.visibleStart = 0;
    this.exitingWish = null;
    this.enteringWishId = null;
    this.loadWishes();
    this.loadGallery();
  }

  private startWishCycle(): void {
    if (this.cycleTimer) {
      window.clearInterval(this.cycleTimer);
    }
    this.cycleTimer = window.setInterval(() => {
      this.cycleWishes();
    }, this.cycleIntervalMs);
  }

  private resetCycle(): void {
    this.visibleStart = 0;
    this.exitingWish = null;
    this.enteringWishId = null;
  }

  private cycleWishes(): void {
    if (this.wishes.length <= 3) {
      return;
    }
    if (this.rotationPaused) {
      return;
    }
    const currentVisible = this.visibleWishes;
    this.exitingWish = currentVisible[0];
    const nextStart = (this.visibleStart + 1) % this.wishes.length;
    const nextBottomIndex = (nextStart + 2) % this.wishes.length;
    this.visibleStart = nextStart;
    this.enteringWishId = this.wishes[nextBottomIndex]?.id ?? null;
    window.setTimeout(() => {
      this.exitingWish = null;
      this.enteringWishId = null;
    }, 650);
  }

  private pulseLike(wishId: string): void {
    const existing = this.likePulseTimers.get(wishId);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      this.likePulseTimers.delete(wishId);
    }, 600);
    this.likePulseTimers.set(wishId, timer);
  }

  private startWishCooldown(): void {
    this.wishCooldown = 5;
    if (this.wishCooldownTimer) {
      window.clearInterval(this.wishCooldownTimer);
    }
    this.wishCooldownTimer = window.setInterval(() => {
      this.wishCooldown -= 1;
      if (this.wishCooldown <= 0 && this.wishCooldownTimer) {
        window.clearInterval(this.wishCooldownTimer);
        this.wishCooldownTimer = null;
        this.wishCooldown = 0;
      }
    }, 1000);
  }

  private showWishPopup(message: string): void {
    this.wishPopup = message;
    this.schedulePopupClear('wish');
  }

  private showRsvpPopup(message: string): void {
    this.rsvpPopup = message;
    this.schedulePopupClear('rsvp');
  }

  private schedulePopupClear(type: 'wish' | 'rsvp'): void {
    if (this.popupTimer) {
      window.clearTimeout(this.popupTimer);
    }
    this.popupTimer = window.setTimeout(() => {
      if (type === 'wish') {
        this.wishPopup = '';
      } else {
        this.rsvpPopup = '';
      }
    }, 2600);
  }
}
