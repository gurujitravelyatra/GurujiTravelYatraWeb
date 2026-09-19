import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import { TourUploadsSection } from '../TourUploadsSection';
import type { TourFormValues } from '@/server/admin/tours/tour-form-schema';

/**
 * The upload controls — Phase C, replacing the Phase B stub that shipped these
 * three inputs `disabled` because nothing could store a file.
 *
 * The behaviours pinned here are the ones an admin would be harmed by getting
 * wrong, in order of severity:
 *
 *  1. a failure is never silent, and says WHY;
 *  2. a rejected file never reaches the network;
 *  3. the rest of the form survives a failed upload;
 *  4. the uploaded file is shown back, so the admin can see what went in.
 */

const CLOUDINARY = 'https://res.cloudinary.com/demo/image/upload/v1/gty/tours/spiti';

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const SVG_BYTES = new Uint8Array(Array.from('<svg xmlns="x"></svg>', (c) => c.charCodeAt(0)));

/**
 * jsdom's `File` has no working `slice().arrayBuffer()` in this version, and the
 * client preflight reads the first 12 bytes through exactly that call. Patched
 * here rather than worked around in the component: the component's use of it is
 * correct and is what makes a renamed file detectable before it is sent.
 */
function fileWithBytes(bytes: Uint8Array<ArrayBuffer>, name: string, type: string): File {
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, 'slice', {
    value: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => bytes.slice(start, end).buffer,
    }),
  });
  Object.defineProperty(file, 'size', { value: bytes.length });
  return file;
}

interface SentRequest {
  kind: string;
  fileName: string;
}

const sent: SentRequest[] = [];
let respondWith: { status: number; body: string } = { status: 200, body: '' };

/**
 * A minimal `XMLHttpRequest` stand-in. XHR is used rather than `fetch` because it
 * is the only API that reports UPLOAD progress (see `use-file-upload.ts`), so the
 * stub emits a progress event before completing — otherwise these tests would
 * pass against a component that showed a fake spinner.
 */
class StubXhr {
  status = 0;
  responseText = '';
  upload = { listeners: {} as Record<string, ((event: unknown) => void)[]>, addEventListener(type: string, fn: (event: unknown) => void) { (this.listeners[type] ??= []).push(fn); } };
  private listeners: Record<string, (() => void)[]> = {};

  open() {}

  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }

  send(body: FormData) {
    const file = body.get('file') as File;
    sent.push({ kind: String(body.get('kind')), fileName: file.name });

    setTimeout(() => {
      for (const fn of this.upload.listeners.progress ?? []) fn({ lengthComputable: true, loaded: 50, total: 100 });
      this.status = respondWith.status;
      this.responseText = respondWith.body;
      for (const fn of this.listeners.load ?? []) fn();
    }, 0);
  }
}

function okResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    data: {
      url: `${CLOUDINARY}/cover_new123.jpg`,
      publicId: 'gty/tours/spiti/cover_new123',
      bytes: 204_800,
      width: 1600,
      height: 1000,
      format: 'jpg',
      fileName: 'photo.jpg',
      kind: 'cover',
      ...overrides,
    },
  });
}

beforeEach(() => {
  sent.length = 0;
  respondWith = { status: 200, body: okResponse() };
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = StubXhr;
});

/** Renders the section inside a real `useForm`, plus a text field to prove it survives. */
function Harness({
  uploadsEnabled = true,
  defaultValues = {},
  coverError,
}: {
  uploadsEnabled?: boolean;
  defaultValues?: Partial<TourFormValues>;
  coverError?: string;
}) {
  const { control, setValue, register } = useForm<TourFormValues>({
    defaultValues: {
      name: '',
      slug: '',
      destinationSlug: '',
      category: 'Spiritual',
      audienceTags: [],
      isHot: false,
      inclusions: [],
      exclusions: [],
      itineraryDays: [],
      faqs: [],
      pricingTiers: [],
      galleryImages: [],
      ...defaultValues,
    },
  });

  return (
    <form>
      <label htmlFor="other-field">Tour name</label>
      <input id="other-field" {...register('name')} />
      <TourUploadsSection
        control={control}
        setValue={setValue}
        editingSlug="spiti-valley"
        uploadsEnabled={uploadsEnabled}
        coverError={coverError}
      />
    </form>
  );
}

describe('when no Cloudinary account is configured', () => {
  it('disables the controls and says why, rather than failing on the first file', () => {
    render(<Harness uploadsEnabled={false} />);

    expect(screen.getByText(/Uploads are unavailable here/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cover image/i)).toBeDisabled();
    expect(screen.getByLabelText(/Gallery images/i)).toBeDisabled();
    expect(screen.getByLabelText(/Brochure PDF/i)).toBeDisabled();
  });

  it('warns that a tour cannot be published without a cover', () => {
    // The consequence the admin would otherwise discover at the Publish button.
    render(<Harness uploadsEnabled={false} />);
    expect(screen.getByText(/cannot be/i)).toHaveTextContent(/published/i);
  });
});

describe('a rejected file never reaches the network', () => {
  it('refuses an SVG renamed to .jpg, with an assertive alert', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText(/Cover image/i), fileWithBytes(SVG_BYTES, 'holiday.jpg', 'image/jpeg'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Upload failed/i);
    expect(alert).toHaveTextContent(/renamed|damaged/i);

    // The client runs the SAME `validateUpload` the server runs, so a file the
    // server would refuse is refused before a byte is sent — which on a slow
    // connection is the difference between instant feedback and a two-minute
    // wait for a 400.
    expect(sent).toHaveLength(0);
  });

  it('tells the admin the rest of the form is untouched', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Tour name'), 'Spiti Valley Circuit');
    await user.upload(screen.getByLabelText(/Cover image/i), fileWithBytes(SVG_BYTES, 'holiday.jpg', 'image/jpeg'));

    await screen.findByRole('alert');

    // The property, not just the promise: an upload is an out-of-band XHR and
    // never submits the form, so a failure cannot cost the admin their typing.
    expect(screen.getByLabelText('Tour name')).toHaveValue('Spiti Valley Circuit');
    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing else on this form has been affected/i);
  });

  it('surfaces a server refusal verbatim rather than flattening it', async () => {
    // "That file is 23 MB. The limit is 10 MB." is actionable; "upload failed" is
    // not. The envelope's `error` string is carried through unchanged.
    respondWith = { status: 413, body: JSON.stringify({ error: 'That file is 23 MB. The limit is 10 MB.' }) };

    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText(/Cover image/i), fileWithBytes(JPEG_BYTES, 'huge.jpg', 'image/jpeg'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/That file is 23 MB\. The limit is 10 MB\./);
  });

  it('explains an expired session in terms the admin can act on', async () => {
    respondWith = { status: 401, body: JSON.stringify({ error: 'Your session has expired. Sign in again, then retry the upload.' }) };

    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText(/Cover image/i), fileWithBytes(JPEG_BYTES, 'photo.jpg', 'image/jpeg'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/session has expired/i);
  });
});

describe('a successful upload', () => {
  it('shows the uploaded cover back, and says it still needs saving', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText(/Cover image/i), fileWithBytes(JPEG_BYTES, 'photo.jpg', 'image/jpeg'));

    // A thumbnail, so the admin can confirm the RIGHT file went in — a filename
    // alone does not catch picking the wrong photo from a camera roll.
    const preview = await screen.findByAltText(/cover image currently attached/i);
    expect(preview).toHaveAttribute('src', expect.stringContaining('res.cloudinary.com'));
    // Asked for at thumbnail size, not the full original.
    expect(preview.getAttribute('src')).toMatch(/c_fill|w_\d+/);

    // An upload is not a save. Saying otherwise is how a tour goes live without
    // the image the admin believes they attached.
    expect(await screen.findByText(/Remember to save the tour/i)).toBeInTheDocument();
    expect(sent).toEqual([{ kind: 'cover', fileName: 'photo.jpg' }]);
  });

  it('sends gallery files under the gallery kind and appends them', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText(/Gallery images/i), fileWithBytes(JPEG_BYTES, 'one.jpg', 'image/jpeg'));

    await waitFor(() => expect(sent).toEqual([{ kind: 'gallery', fileName: 'one.jpg' }]));
  });

  it('shows the brochure by name and size, with a link to the real file', async () => {
    respondWith = {
      status: 200,
      body: okResponse({
        url: 'https://res.cloudinary.com/demo/raw/upload/v1/gty/tours/spiti/brochure/spiti_x1.pdf',
        kind: 'brochure',
        fileName: 'spiti-2026.pdf',
        bytes: 2_516_582,
        width: null,
        height: null,
      }),
    };

    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(
      screen.getByLabelText(/Brochure PDF/i),
      fileWithBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3]), 'spiti-2026.pdf', 'application/pdf')
    );

    expect(await screen.findByText('spiti-2026.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.4 MB')).toBeInTheDocument();
    // No PDF thumbnail is attempted — see `resourceTypeFor()` for why these are
    // uploaded as `raw`. A link that opens the real document is the confirmation.
    expect(screen.getByRole('link', { name: /View PDF/i })).toHaveAttribute('href', expect.stringContaining('.pdf'));
  });
});

describe('the gallery is ordered, and reordering is keyboard-reachable', () => {
  const GALLERY: TourFormValues['galleryImages'] = [
    { url: `${CLOUDINARY}/a.jpg`, publicId: 'a' },
    { url: `${CLOUDINARY}/b.jpg`, publicId: 'b' },
    { url: `${CLOUDINARY}/c.jpg`, publicId: 'c' },
  ];

  it('renders each image with its position', () => {
    render(<Harness defaultValues={{ galleryImages: GALLERY }} />);

    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });

  it('moves an image down, changing the stored order', async () => {
    const user = userEvent.setup();
    render(<Harness defaultValues={{ galleryImages: GALLERY }} />);

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByAltText('Gallery image 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Move gallery image 1 down/i }));

    /**
     * Buttons, not drag-and-drop. The form already reorders itinerary days, FAQs
     * and pricing tiers exactly this way, so this is the idiom the admin has
     * learned — and it works with a keyboard and a screen reader without a
     * bespoke drag implementation. This test would be impossible to write
     * honestly against a mouse-only interaction.
     */
    await waitFor(() => {
      const reordered = screen.getAllByRole('listitem');
      expect(within(reordered[0]).getByAltText('Gallery image 1')).toHaveAttribute(
        'src',
        expect.stringContaining('b.jpg')
      );
    });
  });

  it('disables the arrow that would move an image off either end', () => {
    render(<Harness defaultValues={{ galleryImages: GALLERY }} />);

    expect(screen.getByRole('button', { name: /Move gallery image 1 up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Move gallery image 3 down/i })).toBeDisabled();
  });

  it('removes one image and renumbers the rest', async () => {
    const user = userEvent.setup();
    render(<Harness defaultValues={{ galleryImages: GALLERY }} />);

    await user.click(screen.getByRole('button', { name: /Remove gallery image 2/i }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });
});

describe('the publish requirement is surfaced on the control', () => {
  it('marks the cover field as required to publish', () => {
    render(<Harness />);
    expect(screen.getByText(/required to publish/i)).toBeInTheDocument();
  });

  it('renders the server-side publish refusal against the cover input', () => {
    render(<Harness coverError="A cover image is required to publish — it is the photo on the tour card." />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/cover image is required to publish/i);
    // Marked invalid, not merely described: a described error is not the same as
    // a field a screen reader reports as invalid.
    expect(screen.getByLabelText(/Cover image/i)).toHaveAttribute('aria-invalid', 'true');
  });
});
