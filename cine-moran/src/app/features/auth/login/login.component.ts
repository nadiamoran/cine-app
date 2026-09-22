import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, required, email, submit } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginData } from '../../../core/auth/user.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ RouterLink, FormField],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  errorMsg = signal<string | null>(null);
  loading = signal(false);

  loginModel = signal<LoginData>({ email: '', password: '' });

  loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email, { message: 'El email es obligatorio' });
    email(schemaPath.email, { message: 'El email no es válido' });
    required(schemaPath.password, { message: 'La contraseña es obligatoria' });
  });

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set(null);

    await submit(this.loginForm, async (form) => {
      this.loading.set(true);
      const { error } = await this.authService.login(form().value());
      this.loading.set(false);

      if (error) {
        this.errorMsg.set(error);
        return;
      }
      this.router.navigate(['/']);
    });
  }
}