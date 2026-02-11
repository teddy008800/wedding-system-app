import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminComponent } from './admin';
import { RegisterComponent } from './register';
import { LandingComponent } from './landing';
import { RsvpViewComponent } from './rsvp-view';

@NgModule({
  declarations: [
    App,
    AdminComponent,
    RegisterComponent,
    LandingComponent,
    RsvpViewComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [
    provideBrowserGlobalErrorListeners()
  ],
  bootstrap: [App]
})
export class AppModule { }
