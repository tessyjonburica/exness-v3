import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSignin, useSignup } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/api-errors";

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isLogin = location.pathname === "/signin";

  const signup = useSignup();
  const signin = useSignin();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (isLogin) {
        await signin.mutateAsync({ email, password });
        toast.success("Session established", {
          description: "Your trading terminal is ready.",
        });
        navigate("/trade");
        return;
      }

      await signup.mutateAsync({
        email,
        password,
        name: email.split("@")[0],
      });
      toast.success("Account created", {
        description: "Your Trade X account has been opened successfully.",
      });
      navigate("/trade");
    } catch (error: unknown) {
      toast.error(isLogin ? "Unable to sign in" : "Unable to create account", {
        description: getApiErrorMessage(
          error,
          isLogin
            ? "Your session could not be established. Please review your credentials and try again."
            : "Your account could not be created at this time. Please try again shortly."
        ),
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link to="/" className="mb-8 inline-block">
              <img src={logoImage} alt="TradeX" className="mx-auto h-12" />
            </Link>
            <h1 className="mb-2 text-4xl font-bold">{isLogin ? "Welcome Back" : "Create Account"}</h1>
            <p className="text-gray-600">
              {isLogin ? "Login to continue trading" : "Sign up to start trading on your terminal"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-extrabold">EMAIL</label>
              <Input
                data-testid="auth-email-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                required
                className="font-bold"
                style={{ fontFamily: "IBM Plex Mono, monospace" }}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-extrabold">PASSWORD</label>
              <Input
                data-testid="auth-password-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                className="font-bold"
                style={{ fontFamily: "IBM Plex Mono, monospace" }}
              />
            </div>

            <Button
              data-testid="auth-submit-button"
              type="submit"
              disabled={signup.isPending || signin.isPending}
              className="w-full rounded-full py-6 text-base font-extrabold"
              style={{ fontFamily: "IBM Plex Mono, monospace" }}
            >
              {signup.isPending || signin.isPending ? "LOADING..." : isLogin ? "LOGIN" : "SIGN UP"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to={isLogin ? "/signup" : "/signin"}
              className="text-sm font-bold hover:underline"
              style={{ fontFamily: "IBM Plex Mono, monospace" }}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
