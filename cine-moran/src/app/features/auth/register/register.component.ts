import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { fechaNoFuturaValidator } from '../../../shared/validators/fecha.validators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  errorMsg = signal<string | null>(null);
  loading = signal(false);

  registerForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    apellido: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fechaNacimiento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, fechaNoFuturaValidator()],
    }),
    tipoSangre: new FormControl('', { nonNullable: true }),
    colorOjos: new FormControl('', { nonNullable: true }),
    diasVacaciones: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(365)],
    }),
  });

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  async onSubmit() {
    this.errorMsg.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    // getRawValue() devuelve todos los campos con el tipo exacto de RegisterData
    const { error } = await this.authService.register(this.registerForm.getRawValue());
    this.loading.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }
    this.router.navigate(['/']);
  }
}
