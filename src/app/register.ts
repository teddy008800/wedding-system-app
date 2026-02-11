import { Component, OnInit } from '@angular/core';

declare const supabase: {
  createClient: (url: string, key: string, options?: any) => any;
};

@Component({
  selector: 'app-register',
  templateUrl: './register.html',
  standalone: false,
  styleUrl: './register.css'
})
export class RegisterComponent implements OnInit {
  protected form = {
    groom: '',
    bride: '',
    weddingDate: '',
    venue: '',
    weddingTag: '',
    phoneNumber: '',
    googleMapUrl: '',
    dressCode: '',
    nasheedId: ''
  };
  protected tentativeItems: Array<{ time: string; title: string }> = [
    { time: '', title: '' }
  ];
  protected nasheedOptions: Array<{ id: string; title: string }> = [];
  protected slugError = '';
  protected submitted = false;
  protected loading = false;
  protected actionLoading = false;
  protected actionLoadingText = 'Processing...';
  protected result = '';
  protected confirmModal = {
    open: false,
    message: '',
    onConfirm: null as null | (() => void | Promise<void>)
  };

  private supabaseClient: any | null = null;
  private readonly supabaseUrl = 'https://sksxlvhyjkimyiiaxwtz.supabase.co';
  private readonly supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3hsdmh5amtpbXlpaWF4d3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTQ1NTgsImV4cCI6MjA4NjI3MDU1OH0.wLYx_vlp6jNaW1jN82Ee9dL864kULIUkEc0c7Ruf2ig';

  ngOnInit(): void {
    if (this.supabaseUrl.startsWith('http') && this.supabaseAnonKey.length > 20 && typeof supabase !== 'undefined') {
      this.supabaseClient = supabase.createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      this.loadNasheedOptions();
    }
  }

  protected async submitRegistration(): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    if (!this.supabaseClient) {
      return;
    }
    this.submitted = true;
    if (!this.isFormValid()) {
      return;
    }
    this.openConfirm('Submit wedding registration?', async () => {
      await this.performSubmit();
    });
  }

  private async performSubmit(): Promise<void> {
    this.loading = true;
    this.result = '';
    this.slugError = '';
    try {
      const slug = this.buildSlug(this.form.groom, this.form.bride);
      const slugExists = await this.checkSlug(slug);
      if (slugExists) {
        this.slugError = 'Slug already exists. Please adjust names.';
        return;
      }
      const tentative = this.tentativeItems
        .filter((item) => item.time.trim() || item.title.trim())
        .map((item) => ({
          time: item.time.trim(),
          title: item.title.trim()
        }));
      const payload = {
        slug,
        groom: this.form.groom.trim(),
        bride: this.form.bride.trim(),
        wedding_date: this.form.weddingDate,
        venue: this.form.venue.trim(),
        wedding_tag: this.form.weddingTag.trim(),
        phone_number: this.form.phoneNumber.trim(),
        google_map_url: this.form.googleMapUrl.trim(),
        dress_code: this.form.dressCode.trim(),
        wedding_tentative: tentative.length ? tentative : null,
        nasheed_id: this.form.nasheedId ? this.form.nasheedId.trim() : null,
        created_at: new Date().toISOString()
      };
      const { error } = await this.supabaseClient.from('weddings').insert(payload);
      if (error) {
        throw error;
      }
      this.result = 'Registration submitted!';
      this.form = {
        groom: '',
        bride: '',
        weddingDate: '',
        venue: '',
        weddingTag: '',
        phoneNumber: '',
        googleMapUrl: '',
        dressCode: '',
        nasheedId: ''
      };
      this.tentativeItems = [{ time: '', title: '' }];
      this.submitted = false;
    } catch (error) {
      this.result = 'Unable to submit. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  protected addTentativeRow(): void {
    this.tentativeItems = [...this.tentativeItems, { time: '', title: '' }];
  }

  protected removeTentativeRow(index: number): void {
    if (this.tentativeItems.length === 1) {
      this.tentativeItems = [{ time: '', title: '' }];
      return;
    }
    this.tentativeItems = this.tentativeItems.filter((_, idx) => idx !== index);
  }

  protected get slugPreview(): string {
    if (!this.form.groom && !this.form.bride) {
      return '';
    }
    return this.buildSlug(this.form.groom, this.form.bride);
  }

  protected formatTime(value: string): string {
    if (!value) {
      return '';
    }
    const [hourStr, minuteStr] = value.split(':');
    const hour = Number(hourStr);
    if (Number.isNaN(hour)) {
      return '';
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteStr ?? '00'} ${period}`;
  }

  protected showFieldError(field: string): boolean {
    if (!this.submitted) {
      return false;
    }
    const value = (this.form as any)[field];
    return !value || !String(value).trim();
  }

  private async loadNasheedOptions(): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }
    const { data } = await this.supabaseClient
      .from('nasheed')
      .select('id, title')
      .order('title', { ascending: true });
    this.nasheedOptions = data ?? [];
  }

  private async checkSlug(slug: string): Promise<boolean> {
    const { data, error } = await this.supabaseClient
      .from('weddings')
      .select('id')
      .eq('slug', slug)
      .limit(1);
    if (error) {
      return false;
    }
    return (data ?? []).length > 0;
  }

  private buildSlug(groom: string, bride: string): string {
    return `${groom}-${bride}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private isFormValid(): boolean {
    return Boolean(
      this.form.groom.trim() &&
        this.form.bride.trim() &&
        this.form.weddingDate &&
        this.form.venue.trim() &&
        this.form.phoneNumber.trim() &&
        this.form.googleMapUrl.trim() &&
        this.form.nasheedId.trim()
    );
  }

  protected closeConfirm(): void {
    this.confirmModal.open = false;
    this.confirmModal.message = '';
    this.confirmModal.onConfirm = null;
  }

  protected confirmAction(): void {
    if (this.actionLoading) {
      return;
    }
    void this.runConfirmAction();
  }

  private openConfirm(message: string, onConfirm: () => void | Promise<void>): void {
    this.confirmModal.open = true;
    this.confirmModal.message = message;
    this.confirmModal.onConfirm = onConfirm;
  }

  private async runConfirmAction(): Promise<void> {
    this.actionLoadingText = 'Saving registration...';
    this.actionLoading = true;
    try {
      if (this.confirmModal.onConfirm) {
        await Promise.resolve(this.confirmModal.onConfirm());
      }
    } finally {
      this.actionLoading = false;
      this.closeConfirm();
    }
  }
}
