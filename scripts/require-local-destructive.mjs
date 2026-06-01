const value = String(process.env.LOCAL_DESTRUCTIVE ?? '').trim().toLowerCase();

if (!['1', 'true', 'yes'].includes(value)) {
    console.error(
        'Refusing to run destructive local cleanup without LOCAL_DESTRUCTIVE=yes. Confirm no shared service or production-adjacent state is targeted.'
    );
    process.exit(1);
}
